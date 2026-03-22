import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");
  const ANTHROPIC_API_KEY = Netlify.env.get("ANTHROPIC_API_KEY");

  console.log("[KD Background Scanner v1] Starting at", new Date().toISOString());

  const BASE_URL = "https://api.sam.gov/opportunities/v2/search";
  const allContracts = [];
  const errors = [];

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 90);
  const fmt = (d) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const postedFrom = fmt(pastDate);
  const postedTo = fmt(today);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const searches = [
  { naicsCode: "531110", label: "NAICS 531110 Residential Buildings and Dwellings" },
  { naicsCode: "721110", label: "NAICS 721110 Hotels and Motels" },
  { naicsCode: "721191", label: "NAICS 721191 Bed and Breakfast" },
  { naicsCode: "721199", label: "NAICS 721199 All Other Traveler Accommodation" },
  { naicsCode: "531190", label: "NAICS 531190 Other Real Estate Lessors" },
  { naicsCode: "561599", label: "NAICS 561599 Travel Arrangement Services" },
  { naicsCode: "721310", label: "NAICS 721310 Rooming and Boarding Houses" },
    { keyword: "temporary housing", label: "Temporary housing" },
    { keyword: "furnished housing", label: "Furnished housing" },
    { keyword: "transitional housing", label: "Transitional housing" },
    { keyword: "workforce housing", label: "Workforce housing" },
    { keyword: "seasonal housing", label: "Seasonal housing" },
    { keyword: "crew housing", label: "Crew housing" },
    { keyword: "fire housing", label: "Fire housing" },
    { keyword: "emergency housing", label: "Emergency housing" },
    { keyword: "disaster housing", label: "Disaster housing" },
    { keyword: "relocation housing", label: "Relocation housing" },
    { keyword: "medical resident housing", label: "Medical resident housing" },
    { keyword: "intern housing", label: "Intern housing" },
    { keyword: "student housing government", label: "Student housing" },
    { keyword: "construction site housing", label: "Construction site housing" },
    { keyword: "hotel lodging", label: "Hotel lodging" },
    { keyword: "temporary lodging", label: "Temporary lodging" },
    { keyword: "TDY lodging", label: "TDY lodging" },
    { keyword: "extended stay", label: "Extended stay" },
    { keyword: "sleeping rooms", label: "Sleeping rooms" },
    { keyword: "furnished apartment", label: "Furnished apartment" },
    { keyword: "Yellow Ribbon", label: "Yellow Ribbon" },
    { keyword: "conference hotel", label: "Conference hotel" },
    { keyword: "corporate housing", label: "Corporate housing" },
  ];

  async function searchSAM(params, label) {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", SAM_API_KEY);
    url.searchParams.set("limit", "100");
    url.searchParams.set("postedFrom", postedFrom);
    url.searchParams.set("postedTo", postedTo);
    url.searchParams.set("active", "true");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text();
        console.error(`[KD] ${label} error: HTTP ${res.status}: ${body.slice(0, 150)}`);
        errors.push({ label, status: res.status });
        return [];
      }
      const data = await res.json();
      const opps = data.opportunitiesData || data.opportunities || [];
      console.log(`[KD] ${label}: found ${opps.length}`);
      return opps;
    } catch (err) {
      console.error(`[KD] ${label} error:`, err.message);
      errors.push({ label, error: err.message });
      return [];
    }
  }

  async function enrichContract(contract) {
    if (!ANTHROPIC_API_KEY) return contract;
    const city = contract.placeOfPerformance?.city?.name || "";
    const state = contract.placeOfPerformance?.state?.code || "";
    const description = contract.description || contract.synopsis || "";
    const title = contract.title || contract.solicitationTitle || "";

    const prompt = `You are analyzing a US government contract for KD Modern Rentals LLC (WOSB housing contractor).
CONTRACT: ${title}
LOCATION: ${city}, ${state}
DESCRIPTION: ${description}

Extract requirements and respond ONLY with valid JSON:
{
  "propType": "<hotel, apartment, cottage, or other>",
  "totalUnitsOrRooms": <number or null>,
  "startDate": "<date or null>",
  "endDate": "<date or null>",
  "setAside": "<WOSB, Small Business, 8a, Unrestricted>",
  "estimatedValue": "<dollar amount or null>",
  "pocName": "<name or null>",
  "pocEmail": "<email or null>",
  "pocPhone": "<phone or null>",
  "requiresParking": <true/false>,
  "requiresWifi": <true/false>,
  "requiresKitchen": <true/false>,
  "requiresLaundry": <true/false>,
  "requiresADA": <true/false>,
  "vendorSuggestions": ["<3 to 5 specific hotel or apartment names in that city that could fulfill this>"]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return contract;
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      return { ...contract, _enriched: true, _sowRequirements: parsed, _enrichedAt: new Date().toISOString() };
    } catch (err) {
      console.error("[KD] Enrich error:", err.message);
      return contract;
    }
  }

  for (const search of searches) {
    const { label, ...params } = search;
    const results = await searchSAM(params, label);
    allContracts.push(...results);
    await delay(2000);
  }

  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || JSON.stringify(c).slice(0, 50);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Background Scanner v1] Found ${unique.length} unique contracts`);

  const enriched = [];
  for (const contract of unique) {
    const enrichedContract = await enrichContract(contract);
    enriched.push(enrichedContract);
    await delay(500);
  }

  console.log(`[KD Background Scanner v1] Enriched ${enriched.length} contracts`);

  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: enriched.length,
      contracts: enriched,
    });
    console.log(`[KD Background Scanner v1] Saved ${enriched.length} contracts successfully`);
  } catch (err) {
    console.error("[KD Background Scanner v1] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
  type: "scheduled-background",
};
