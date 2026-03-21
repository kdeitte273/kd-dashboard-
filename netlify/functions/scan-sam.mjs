import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");

  console.log("[KD Scanner v10] Starting at", new Date().toISOString());
  console.log("[KD] SAM key present:", !!SAM_API_KEY);

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

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 5 targeted searches -- covers housing, hotels, AND Yellow Ribbon/events
  const searches = [
    { naicsCode: "531110", label: "NAICS 531110 Residential Rentals" },
    { naicsCode: "721110", label: "NAICS 721110 Hotels and Motels" },
    { keyword: "temporary housing lodging furnished apartment", label: "Housing keywords" },
    { keyword: "Yellow Ribbon event sleeping rooms", label: "Yellow Ribbon events" },
    { keyword: "reintegration event hotel conference lodging rooms", label: "Military event lodging" },
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
        console.error(`[KD] ${label} error: HTTP ${res.status}: ${body.slice(0, 200)}`);
        errors.push({ label, status: res.status });
        return [];
      }
      const data = await res.json();
      const opps = data.opportunitiesData || data.opportunities || [];
      console.log(`[KD] ${label}: found ${opps.length} results`);
      return opps;
    } catch (err) {
      console.error(`[KD] ${label} fetch error:`, err.message);
      errors.push({ label, error: err.message });
      return [];
    }
  }

  for (const search of searches) {
    const { label, ...params } = search;
    const results = await searchSAM(params, label);
    allContracts.push(...results);
    await delay(3000); // 3 seconds between each call
  }

  // Deduplicate
  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || JSON.stringify(c).slice(0, 50);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v10] Total unique contracts found: ${unique.length}`);
  console.log(`[KD] Errors: ${errors.length > 0 ? errors.map((e) => `${e.label}: ${e.status || e.error}`).join(" | ") : "None"}`);

  if (unique.length > 0) {
    console.log("[KD] Sample titles:");
    unique.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title || c.solicitationTitle || "No title"}`);
    });
  }

  // Save to Netlify Blobs
  try {
    const store = getStore("kd-contracts");
    const saveData = {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
    };
    await store.setJSON("latest-scan", saveData);
    console.log(`[KD Scanner v10] Saved ${unique.length} contracts to Netlify Blobs successfully`);
  } catch (err) {
    console.error("[KD Scanner v10] Blob save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
};
