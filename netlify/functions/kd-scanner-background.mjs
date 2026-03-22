import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");

  console.log("[KD Scanner v8] Starting at", new Date().toISOString());

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
    // CORE HOUSING
    { keyword: "temporary housing",        label: "Temporary housing" },
    { keyword: "furnished housing",         label: "Furnished housing" },
    { keyword: "transitional housing",      label: "Transitional housing" },
    { keyword: "workforce housing",         label: "Workforce housing" },
    { keyword: "seasonal housing",          label: "Seasonal housing" },
    { keyword: "crew housing",              label: "Crew housing" },
    { keyword: "fire housing",              label: "Fire housing" },
    { keyword: "emergency housing",         label: "Emergency housing" },
    { keyword: "relocation housing",        label: "Relocation housing" },
    { keyword: "resident housing",          label: "Resident housing" },
    { keyword: "medical resident housing",  label: "Medical resident housing" },
    { keyword: "family housing",            label: "Family housing" },
    { keyword: "VA housing",                label: "VA housing" },
    { keyword: "veteran housing",           label: "Veteran housing" },
    { keyword: "corporate housing",         label: "Corporate housing" },
    { keyword: "intern housing",            label: "Intern housing" },
    { keyword: "government housing",        label: "Government housing" },
    { keyword: "fire crew quarters",        label: "Fire crew quarters" },
    { keyword: "government quarters",       label: "Government quarters" },
    { keyword: "direct lease",              label: "Direct lease" },
    { keyword: "multifamily lease",         label: "Multifamily lease" },
    { keyword: "turnkey residential",       label: "Turnkey residential" },
    { keyword: "housing space",             label: "Housing space" },
    // LODGING
    { keyword: "hotel lodging",             label: "Hotel lodging" },
    { keyword: "temporary lodging",         label: "Temporary lodging" },
    { keyword: "TDY lodging",               label: "TDY lodging" },
    { keyword: "transient lodging",         label: "Transient lodging" },
    { keyword: "lodging services",          label: "Lodging services" },
    { keyword: "lodging accommodations",    label: "Lodging accommodations" },
    { keyword: "lodging program",           label: "Lodging program" },
    { keyword: "lodging BPA",               label: "Lodging BPA" },
    { keyword: "lodging IDIQ",              label: "Lodging IDIQ" },
    { keyword: "hotel accommodations",      label: "Hotel accommodations" },
    { keyword: "hotel accommodation",       label: "Hotel accommodation" },
    { keyword: "motel accommodations",      label: "Motel accommodations" },
    { keyword: "sleeping rooms",            label: "Sleeping rooms" },
    { keyword: "billeting",                 label: "Billeting" },
    { keyword: "dormitory lodging",         label: "Dormitory lodging" },
    { keyword: "bunkhouse",                 label: "Bunkhouse" },
    { keyword: "off center lodging",        label: "Off center lodging" },
    { keyword: "off-post lodging",          label: "Off-post lodging" },
    { keyword: "overflow lodging",          label: "Overflow lodging" },
    { keyword: "patient lodging",           label: "Patient lodging" },
    { keyword: "hoptel",                    label: "Hoptel VA program" },
    // APARTMENTS & FURNISHED
    { keyword: "furnished apartment",       label: "Furnished apartment" },
    { keyword: "serviced apartment",        label: "Serviced apartment" },
    { keyword: "apartment rentals",         label: "Apartment rentals" },
    { keyword: "extended stay",             label: "Extended stay" },
    // NATIONAL GUARD / MILITARY EVENTS
    { keyword: "Yellow Ribbon",             label: "Yellow Ribbon" },
    { keyword: "YRRP",                      label: "YRRP reintegration" },
    { keyword: "post deployment",           label: "Post deployment" },
    { keyword: "UTA lodging",               label: "UTA lodging" },
    { keyword: "RSD lodging",               label: "RSD lodging" },
    { keyword: "drill lodging",             label: "Drill lodging" },
    { keyword: "wing lodging",              label: "Wing lodging" },
    { keyword: "air show lodging",          label: "Air show lodging" },
    { keyword: "airshow lodging",           label: "Airshow lodging" },
    { keyword: "PANAMAX",                   label: "PANAMAX lodging" },
    // FEMA / DISASTER
    { keyword: "direct lease program",      label: "Direct lease program" },
    { keyword: "disaster housing",          label: "Disaster housing" },
    { keyword: "FEMA housing",              label: "FEMA housing" },
    // VA / VETERANS HEALTH
    { keyword: "VHA lodging",               label: "VHA lodging" },
    { keyword: "veterans lodging",          label: "Veterans lodging" },
    { keyword: "veterans summer sports",    label: "Veterans summer sports" },
    // TRAINING / CONFERENCE EVENTS
    { keyword: "lodging and meals",         label: "Lodging and meals" },
    { keyword: "lodging meals conference",  label: "Lodging meals conference" },
    { keyword: "conference lodging",        label: "Conference lodging" },
    { keyword: "symposium lodging",         label: "Symposium lodging" },
    { keyword: "training lodging",          label: "Training lodging" },
    { keyword: "spiritual resiliency",      label: "Spiritual resiliency retreat" },
    // ALTERNATIVE ACCOMMODATIONS
    { keyword: "cottage rental",            label: "Cottage rental" },
    { keyword: "cabin lodging",             label: "Cabin lodging" },
    { keyword: "RV park lodging",           label: "RV park lodging" },
    { keyword: "manufactured housing",      label: "Manufactured housing" },
    { keyword: "mobile home lodging",       label: "Mobile home lodging" },
    { keyword: "houseboat lodging",         label: "Houseboat lodging" },
    // EMBASSY / OVERSEAS / SPECIAL PROGRAMS
    { keyword: "Sail 250",                  label: "Sail 250" },
    { keyword: "OPDAT",                     label: "OPDAT training lodging" },
    { keyword: "ICITAP",                    label: "ICITAP training lodging" },
    { keyword: "NESA lodging",              label: "NESA lodging" },
    { keyword: "CARIC lodging",             label: "CARIC lodging" },
    { keyword: "ICHIP",                     label: "ICHIP forum lodging" },
  ];

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
    "warehouse lease","office space lease","office lease",
    "unmanned aerial","kinetic counter",
  ];

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
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k === "keyword" ? "title" : k, v);
    }
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

  console.log(`[KD Scanner v8] ${unique.length} unique housing contracts`);

  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: unique.length,
      contracts: unique,
    });
    console.log(`[KD Scanner v8] Saved ${unique.length} contracts to Blobs`);
  } catch (err) {
    console.error("[KD Scanner v8] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
  type: "scheduled-background",
};
