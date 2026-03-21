export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");
  const SUPABASE_URL = Netlify.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY");

  console.log("[KD Scanner v4] Starting at", new Date().toISOString());
  console.log("[KD] SAM key present:", !!SAM_API_KEY);
  console.log("[KD] Supabase URL present:", !!SUPABASE_URL);
  console.log("[KD] Supabase key present:", !!SUPABASE_ANON_KEY);

  // SAM.gov Opportunities API v2 - correct endpoint
  const BASE_URL = "https://api.sam.gov/opportunities/v2/search";

  const allContracts = [];
  const errors = [];

  // Date range: today back 90 days
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 90);
  const formatDate = (d) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const postedFrom = formatDate(pastDate);
  const postedTo = formatDate(today);

  // KD Modern Rentals target NAICS codes
  const naicsCodes = [
    "531110",
    "721110",
    "721191",
    "721199",
    "721211",
    "531190",
  ];

  // Title keyword searches
  const titleKeywords = [
    "housing",
    "lodging",
    "hotel",
    "motel",
    "furnished",
    "temporary housing",
    "seasonal housing",
    "fire housing",
    "crew housing",
    "extended stay",
    "apartment",
    "transitional",
    "cottage",
    "guest house",
  ];

  // Helper: call SAM API
  async function searchSAM(params, label) {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", SAM_API_KEY);
    url.searchParams.set("limit", "25");
    url.searchParams.set("postedFrom", postedFrom);
    url.searchParams.set("postedTo", postedTo);
    url.searchParams.set("active", "true");

    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text();
        console.error(`[KD] ${label} error: HTTP ${res.status}: ${body.slice(0, 300)}`);
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

  // Strategy 1: NAICS code searches
  console.log("[KD] Strategy 1: NAICS code searches");
  for (const naics of naicsCodes) {
    const results = await searchSAM({ naicsCode: naics }, `NAICS ${naics}`);
    allContracts.push(...results);
  }

  // Strategy 2: Title keyword searches
  console.log("[KD] Strategy 2: Title keyword searches");
  for (const kw of titleKeywords) {
    const results = await searchSAM({ keyword: kw }, `Keyword "${kw}"`);
    allContracts.push(...results);
  }

  // Deduplicate by noticeId
  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || JSON.stringify(c).slice(0, 50);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v4] Total unique contracts found: ${unique.length}`);
  console.log(
    `[KD] Errors: ${errors.map((e) => `${e.label}: HTTP ${e.status || e.error}`).join(" | ") || "None"}`
  );

  // Save to Supabase
  if (unique.length > 0 && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const savePayload = {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
      errors: errors,
    };

    try {
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(savePayload),
      });

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        console.error(`[KD Scanner v4] Save error: Supabase ${saveRes.status} - ${errText.slice(0, 300)}`);
      } else {
        console.log(`[KD Scanner v4] Saved ${unique.length} contracts to Supabase successfully`);
      }
    } catch (saveErr) {
      console.error("[KD Scanner v4] Supabase save threw:", saveErr.message);
    }
  } else if (unique.length === 0) {
    console.log("[KD Scanner v4] No contracts to save");
  } else {
    console.warn("[KD Scanner v4] Supabase env vars missing - skipping save");
  }
};

export const config = {
  schedule: "*/15 * * * *",
};
