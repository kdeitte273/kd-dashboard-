import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");

  console.log("[KD Scanner v7] Starting at", new Date().toISOString());
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

  const naicsCodes = ["531110", "721110", "721191", "721199", "721211", "531190"];
  const titleKeywords = [
    "housing", "lodging", "hotel", "motel", "furnished",
    "temporary housing", "seasonal housing", "fire housing",
    "crew housing", "extended stay", "apartment", "transitional",
    "cottage", "guest house",
  ];

  async function searchSAM(params, label) {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", SAM_API_KEY);
    url.searchParams.set("limit", "25");
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

  console.log("[KD] Strategy 1: NAICS code searches");
  for (const naics of naicsCodes) {
    const results = await searchSAM({ naicsCode: naics }, `NAICS ${naics}`);
    allContracts.push(...results);
  }

  console.log("[KD] Strategy 2: Title keyword searches");
  for (const kw of titleKeywords) {
    const results = await searchSAM({ keyword: kw }, `Keyword "${kw}"`);
    allContracts.push(...results);
  }

  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || JSON.stringify(c).slice(0, 50);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v7] Total unique contracts found: ${unique.length}`);
  console.log(`[KD] Errors: ${errors.length > 0 ? errors.map((e) => `${e.label}: ${e.status || e.error}`).join(" | ") : "None"}`);

  try {
    const store = getStore("kd-contracts");
    const saveData = {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
    };
    await store.setJSON("latest-scan", saveData);
    console.log(`[KD Scanner v7] Saved ${unique.length} contracts to Netlify Blobs successfully`);
  } catch (err) {
    console.error("[KD Scanner v7] Blob save error:", err.message);
  }
};

export const config = {
  schedule: "*/15 * * * *",
};
