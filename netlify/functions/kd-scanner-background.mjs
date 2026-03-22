import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");

  console.log("[KD Scanner v5] Starting at", new Date().toISOString());

  const BASE_URL = "https://api.sam.gov/opportunities/v2/search";
  const allContracts = [];

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 90);
  const fmt = (d) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const postedFrom = fmt(pastDate);
  const postedTo = fmt(today);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const searches = [
    
    { keyword: "temporary housing",        label: "Temporary housing" },
    { keyword: "furnished housing",         label: "Furnished housing" },
    { keyword: "transitional housing",      label: "Transitional housing" },
    { keyword: "workforce housing",         label: "Workforce housing" },
    { keyword: "seasonal housing",          label: "Seasonal housing" },
    { keyword: "crew housing",              label: "Crew housing" },
    { keyword: "fire housing",              label: "Fire housing" },
    { keyword: "emergency housing",         label: "Emergency housing" },
    { keyword: "relocation housing",        label: "Relocation housing" },
    { keyword: "medical resident housing",  label: "Medical resident housing" },
    { keyword: "hotel lodging",             label: "Hotel lodging" },
    { keyword: "temporary lodging",         label: "Temporary lodging" },
    { keyword: "TDY lodging",               label: "TDY lodging" },
    { keyword: "extended stay",             label: "Extended stay" },
    { keyword: "furnished apartment",       label: "Furnished apartment" },
    { keyword: "Yellow Ribbon",             label: "Yellow Ribbon" },
    { keyword: "lodging services",          label: "Lodging services" },
    { keyword: "apartment rentals",         label: "Apartment rentals" },
    { keyword: "sleeping rooms",            label: "Sleeping rooms" },
    { keyword: "corporate housing",         label: "Corporate housing" },
    { keyword: "billeting",                 label: "Billeting" },
  ];

  // Only reject known non-housing equipment/supply contracts
  const REJECT = [
    "coupling","shaft","valve","pump","bearing","fitting","gasket",
    "bushing","nonmetallic","motor,","engine,","gear,",
    "bracket","switch,","amplifier","transmitter",
    "antenna","connector","resistor","capacitor","circuit board",
    "ammunition","weapon","missile","grenade","explosive","ordnance",
    "helicopter","fuselage","rotor,","propeller","turbine",
    "axle,","hydraulic","pneumatic","cylinder,","piston","compressor,",
    "curtain assembly","power unit","generator set",
    "catering equipment","reagent","specimen","solvent",
    "buoy","hoist,","winch,","rigging",
    "nsn:","p/n ","part number","fsc ",
    "dla land","dla aviation","dla maritime",
    "facilities condition assessment",
    "hpu start replacement",
  ];

  // Only reject if title matches junk words -- pass everything else through
  function isNotJunk(title) {
    if (!title) return true;
    const t = title.toLowerCase();
    for (const w of REJECT) {
      if (t.includes(w)) return false;
    }
    return true;
  }

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
        console.error(`[KD] ${label} HTTP ${res.status}: ${body.slice(0, 100)}`);
        return [];
      }
      const data = await res.json();
      const opps = data.opportunitiesData || data.opportunities || [];
      const filtered = opps.filter(o => isNotJunk(o.title));
      console.log(`[KD] ${label}: ${opps.length} raw -> ${filtered.length} passed filter`);
      return filtered;
    } catch (err) {
      console.error(`[KD] ${label} error:`, err.message);
      return [];
    }
  }

  for (const search of searches) {
    const { label, ...params } = search;
    const results = await searchSAM(params, label);
    allContracts.push(...results);
    await delay(400);
  }

  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || c.title + c.postedDate;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v5] ${unique.length} unique contracts saved`);

  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
    });
    console.log(`[KD Scanner v5] Saved ${unique.length} contracts to Blobs`);
  } catch (err) {
    console.error("[KD Scanner v5] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
  type: "scheduled-background",
};
