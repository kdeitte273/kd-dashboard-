import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");

  console.log("[KD Scanner v4] Starting at", new Date().toISOString());

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
    { naicsCode: "531110", label: "NAICS 531110 Residential Buildings" },
    { naicsCode: "721110", label: "NAICS 721110 Hotels and Motels" },
    { naicsCode: "721199", label: "NAICS 721199 All Other Traveler Accommodation" },
    { naicsCode: "531190", label: "NAICS 531190 Other Real Estate Lessors" },
    { naicsCode: "721310", label: "NAICS 721310 Rooming and Boarding Houses" },
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

  const REJECT = [
    "pipe","coupling","shaft","valve","pump","bearing","fitting","gasket",
    "bushing","nonmetallic","cable,","wire,","motor,","engine,","gear,",
    "bracket","switch,","radio,","receiver,","amplifier","transmitter",
    "antenna","connector","resistor","capacitor","circuit board","battery,",
    "filter,","seal,","sleeve,","slide,","ammunition","weapon","missile",
    "grenade","explosive","ordnance","aircraft","helicopter","fuselage",
    "rotor,","propeller","turbine","truck,","trailer,","axle,","wheel,",
    "tire,","brake,","hydraulic","pneumatic","cylinder,","piston",
    "compressor,","curtain assembly","curtain,","power supply","power unit",
    "generator set","food service equipment","catering equipment","uniform,",
    "boot,","glove,","helmet,","laboratory equipment","reagent","specimen",
    "chemical,","solvent","lumber,","concrete,","steel,","aluminum,","fuel,",
    "buoy","crane,","hoist,","winch,","rigging","nsn:","nsn ","p/n ",
    "part number","fsc ","qty:","dla land","dla aviation","dla maritime",
    "facilities condition assessment","ranger district facilities",
    "hpu start replacement","induct pipe","induct fitting",
    "skin,aircraft","vane,pump","amplifier,radio","power,supply",
  ];

  const REQUIRE = [
    "housing","lodging","hotel","motel","apartment","suite","furnished",
    "residential","dwelling","accommodation","boarding","hostel",
    "bed and breakfast","extended stay","tdy","billeting","quarters",
    "relocation","workforce","yellow ribbon","sleeping room","transient",
    "temporary housing","crew housing","medical resident","apartment rental",
  ];

  function isHousing(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    for (const w of REJECT) {
      if (t.includes(w)) return false;
    }
    return REQUIRE.some(w => t.includes(w));
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
      const filtered = opps.filter(o => isHousing(o.title));
      console.log(`[KD] ${label}: ${opps.length} raw -> ${filtered.length} housing`);
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

  console.log(`[KD Scanner v4] ${unique.length} unique housing contracts`);

  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
    });
    console.log(`[KD Scanner v4] Saved ${unique.length} contracts`);
  } catch (err) {
    console.error("[KD Scanner v4] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
  type: "scheduled-background",
};
