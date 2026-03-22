import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");
  const ANTHROPIC_API_KEY = Netlify.env.get("ANTHROPIC_API_KEY");

  console.log("[KD Background Scanner v3] Starting at", new Date().toISOString());

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

  // ── HOUSING-ONLY SEARCHES ─────────────────────────────────────────────────
  const searches = [
    { naicsCode: "531110", label: "NAICS 531110 Residential Buildings" },
    { naicsCode: "721110", label: "NAICS 721110 Hotels and Motels" },
    { naicsCode: "721191", label: "NAICS 721191 Bed and Breakfast" },
    { naicsCode: "721199", label: "NAICS 721199 All Other Traveler Accommodation" },
    { naicsCode: "531190", label: "NAICS 531190 Other Real Estate Lessors" },
    { naicsCode: "721310", label: "NAICS 721310 Rooming and Boarding Houses" },
    { keyword: "temporary housing",       label: "Temporary housing" },
    { keyword: "furnished housing",        label: "Furnished housing" },
    { keyword: "transitional housing",     label: "Transitional housing" },
    { keyword: "workforce housing",        label: "Workforce housing" },
    { keyword: "seasonal housing",         label: "Seasonal housing" },
    { keyword: "crew housing",             label: "Crew housing" },
    { keyword: "fire housing",             label: "Fire housing" },
    { keyword: "emergency housing",        label: "Emergency housing" },
    { keyword: "disaster housing",         label: "Disaster housing" },
    { keyword: "relocation housing",       label: "Relocation housing" },
    { keyword: "medical resident housing", label: "Medical resident housing" },
    { keyword: "intern housing",           label: "Intern housing" },
    { keyword: "hotel lodging",            label: "Hotel lodging" },
    { keyword: "temporary lodging",        label: "Temporary lodging" },
    { keyword: "TDY lodging",              label: "TDY lodging" },
    { keyword: "extended stay",            label: "Extended stay" },
    { keyword: "sleeping rooms",           label: "Sleeping rooms" },
    { keyword: "furnished apartment",      label: "Furnished apartment" },
    { keyword: "Yellow Ribbon",            label: "Yellow Ribbon" },
    { keyword: "conference hotel",         label: "Conference hotel" },
    { keyword: "corporate housing",        label: "Corporate housing" },
    { keyword: "lodging services",         label: "Lodging services" },
    { keyword: "apartment rentals",        label: "Apartment rentals" },
    { keyword: "billeting",                label: "Billeting" },
    { keyword: "quarters",                 label: "Quarters" },
  ];

  // ── BULLETPROOF HOUSING FILTER ────────────────────────────────────────────
  // Step 1: Reject if title contains ANY of these non-housing words
  const REJECT_WORDS = [
    "pipe", "coupling", "shaft", "valve", "pump", "bearing", "fitting",
    "gasket", "bushing", "bolt,", "nut,", "screw,", "washer,",
    "nonmetallic", "cable,", "wire,", "motor,", "engine,", "gear,",
    "bracket", "switch,", "radio,", "receiver,", "amplifier", "transmitter",
    "antenna", "connector", "resistor", "capacitor", "circuit board",
    "battery,", "filter,", "seal,", "sleeve,", "slide,",
    "ammunition", "weapon", "missile", "grenade", "explosive", "ordnance",
    "aircraft", "helicopter", "fuselage", "rotor,", "propeller", "turbine",
    "truck,", "trailer,", "axle,", "wheel,", "tire,", "brake,",
    "hydraulic", "pneumatic", "cylinder,", "piston", "compressor,",
    "curtain assembly", "curtain,",
    "power supply", "power unit", "generator set", "alternator,",
    "food service equipment", "catering equipment",
    "uniform,", "boot,", "glove,", "helmet,",
    "laboratory equipment", "reagent", "specimen", "chemical,", "solvent",
    "lumber,", "concrete,", "steel,", "aluminum,", "fuel,",
    "buoy", "crane,", "hoist,", "winch,", "rigging",
    "nsn:", "nsn ", "p/n ", "part number", "fsc ",
    "qty:", "dla land", "dla aviation", "dla maritime",
    "facilities condition assessment",
    "ranger district facilities",
    "hpu start replacement",
    "induct pipe", "induct fitting",
  ];

  // Step 2: Must contain at least one housing word to pass
  const REQUIRE_ONE_OF = [
    "housing", "lodging", "hotel", "motel", "apartment", "suite",
    "furnished", "temporary lodging", "residential", "dwelling",
    "accommodation", "boarding", "hostel", "bed and breakfast",
    "extended stay", "tdy", "billeting", "quarters", "barracks",
    "relocation", "workforce", "seasonal housing", "fire crew housing",
    "yellow ribbon", "sail 250", "sleeping room", "transient",
    "temporary housing", "crew housing", "intern housing",
  ];

  function isHousingContract(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    // Reject if any non-housing word found
    for (const word of REJECT_WORDS) {
      if (t.includes(word)) return false;
    }
    // Must have at least one housing word
    return REQUIRE_ONE_OF.some(word => t.includes(word));
  }

  // ── SAM.GOV SEARCH ────────────────────────────────────────────────────────
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
      const filtered = opps.filter(o => isHousingContract(o.title));
      console.log(`[KD] ${label}: ${opps.length} raw → ${filtered.length} housing contracts`);
      return filtered;
    } catch (err) {
      console.error(`[KD] ${label} error:`, err.message);
      errors.push({ label, error: err.message });
      return [];
    }
  }

  // ── AI ENRICHMENT ─────────────────────────────────────────────────────────
  async function enrichContract(contract) {
    if (!ANTHROPIC_API_KEY) return contract;
    const city = contract.placeOfPerformance?.city?.name || "";
    const state = contract.placeOfPerformance?.state?.code || "";
    const description = contract.description || contract.synopsis || "";
    const title = contract.title || contract.solicitationTitle || "";

    const prompt = `You are analyzing a US government housing contract for KD Modern Rentals LLC (WOSB housing contractor).
CONTRACT: ${title}
LOCATION: ${city}, ${state}
DESCRIPTION: ${description.slice(0, 500)}

Respond ONLY with valid JSON, no other text:
{
  "propType": "<hotel, apartment, or mixed>",
  "totalUnitsOrRooms": <number or null>,
  "estimatedNightsPerYear": <number or null>,
  "estimatedAnnualValue": <number or null>,
  "profitPotential": "<high, medium, or low>",
  "setAside": "<WOSB, Small Business, 8a, SDVOSB, or Unrestricted>",
  "pocName": "<name or null>",
  "pocEmail": "<email or null>",
  "pocPhone": "<phone or null>",
  "requiresParking": <true or false>,
  "requiresWifi": <true or false>,
  "requiresKitchen": <true or false>,
  "requiresLaundry": <true or false>,
  "requiresADA": <true or false>
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return contract;
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1) return contract;
      const parsed = JSON.parse(text.slice(start, end + 1));
      return { ...contract, _enriched: true, _sowRequirements: parsed, _enrichedAt: new Date().toISOString() };
    } catch (err) {
      console.error("[KD] Enrich error:", err.message);
      return contract;
    }
  }

  // ── RUN ALL SEARCHES ──────────────────────────────────────────────────────
  for (const search of searches) {
    const { label, ...params } = search;
    const results = await searchSAM(params, label);
    allContracts.push(...results);
    await delay(2000);
  }

  // ── DEDUPLICATE ───────────────────────────────────────────────────────────
  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || c.title + c.postedDate;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v3] ${unique.length} unique housing contracts after dedup`);

  // ── ENRICH WITH AI ────────────────────────────────────────────────────────
  const enriched = [];
  for (const contract of unique) {
    const enrichedContract = await enrichContract(contract);
    enriched.push(enrichedContract);
    await delay(300);
  }

  console.log(`[KD Scanner v3] Enriched ${enriched.length} contracts`);

  // ── SAVE TO BLOBS ─────────────────────────────────────────────────────────
  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: enriched.length,
      contracts: enriched,
    });
    console.log(`[KD Scanner v3] Saved ${enriched.length} contracts to Blobs`);
  } catch (err) {
    console.error("[KD Scanner v3] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
  type: "scheduled-background",
};
