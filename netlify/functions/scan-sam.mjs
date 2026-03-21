import { getStore } from "@netlify/blobs";

export default async (req) => {
  const SAM_API_KEY = Netlify.env.get("SAM_API_KEY");
  const ANTHROPIC_API_KEY = Netlify.env.get("ANTHROPIC_API_KEY");

  console.log("[KD Scanner v12] Starting at", new Date().toISOString());

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

  // ── COMPREHENSIVE SEARCH LIST ─────────────────────────────────────────────
  // Every possible housing, lodging, event, and accommodation contract type
  const searches = [
    // Primary NAICS codes
    { naicsCode: "531110", label: "NAICS 531110 Residential Buildings" },
    { naicsCode: "721110", label: "NAICS 721110 Hotels and Motels" },
    { naicsCode: "721191", label: "NAICS 721191 Bed and Breakfast" },
    { naicsCode: "721199", label: "NAICS 721199 All Other Traveler Accommodation" },
    { naicsCode: "721211", label: "NAICS 721211 RV Parks and Campgrounds" },
    { naicsCode: "531190", label: "NAICS 531190 Other Real Estate Lessors" },
    { naicsCode: "721214", label: "NAICS 721214 Recreational and Vacation Camps" },
    { naicsCode: "531120", label: "NAICS 531120 Nonresidential Buildings" },
    { naicsCode: "561599", label: "NAICS 561599 Travel Arrangement Services" },
    { naicsCode: "722310", label: "NAICS 722310 Food Service Contractors" },
    { naicsCode: "711310", label: "NAICS 711310 Promoters of Events" },
    // Housing keywords
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
    // Hotel and lodging keywords
    { keyword: "hotel lodging", label: "Hotel lodging" },
    { keyword: "temporary lodging", label: "Temporary lodging" },
    { keyword: "TDY lodging", label: "TDY lodging" },
    { keyword: "extended stay", label: "Extended stay" },
    { keyword: "sleeping rooms", label: "Sleeping rooms" },
    { keyword: "motel accommodations", label: "Motel accommodations" },
    { keyword: "inn lodging", label: "Inn lodging" },
    // Alternative accommodations
    { keyword: "cottage rental government", label: "Cottage rental" },
    { keyword: "cabin lodging", label: "Cabin lodging" },
    { keyword: "guest house government", label: "Guest house" },
    { keyword: "bed breakfast government", label: "Bed and breakfast" },
    { keyword: "vacation rental government", label: "Vacation rental" },
    { keyword: "mobile home government", label: "Mobile home" },
    { keyword: "manufactured housing government", label: "Manufactured housing" },
    { keyword: "RV park government", label: "RV park" },
    { keyword: "recreational vehicle housing", label: "RV housing" },
    { keyword: "tiny house government", label: "Tiny house" },
    { keyword: "modular housing government", label: "Modular housing" },
    // Marine and waterfront
    { keyword: "vessel berthing government", label: "Vessel berthing" },
    { keyword: "boat docking accommodations", label: "Boat docking" },
    { keyword: "cruise ship charter", label: "Cruise ship charter" },
    { keyword: "floating hotel", label: "Floating hotel" },
    { keyword: "waterfront lodging government", label: "Waterfront lodging" },
    { keyword: "marina accommodations", label: "Marina accommodations" },
    // Event and conference
    { keyword: "Yellow Ribbon", label: "Yellow Ribbon" },
    { keyword: "Yellow Ribbon event", label: "Yellow Ribbon event" },
    { keyword: "pre-deployment event", label: "Pre-deployment event" },
    { keyword: "reintegration event", label: "Reintegration event" },
    { keyword: "conference hotel", label: "Conference hotel" },
    { keyword: "event lodging", label: "Event lodging" },
    { keyword: "conference facility lodging", label: "Conference facility lodging" },
    { keyword: "training facility lodging", label: "Training facility lodging" },
    { keyword: "retreat facility", label: "Retreat facility" },
    { keyword: "conference center accommodations", label: "Conference center" },
    { keyword: "banquet hall lodging", label: "Banquet hall lodging" },
    { keyword: "event space sleeping rooms", label: "Event space sleeping rooms" },
    // Apartment and residential
    { keyword: "furnished apartment", label: "Furnished apartment" },
    { keyword: "apartment rental government", label: "Apartment rental" },
    { keyword: "residential lease government", label: "Residential lease" },
    { keyword: "townhouse government lease", label: "Townhouse lease" },
    { keyword: "duplex government housing", label: "Duplex housing" },
    { keyword: "house rental government", label: "House rental" },
    { keyword: "property lease government", label: "Property lease" },
    // Food and catering
    { keyword: "catering event government", label: "Catering event" },
    { keyword: "food service lodging", label: "Food service lodging" },
    { keyword: "meal service government housing", label: "Meal service housing" },
    // Transportation
    { keyword: "airline travel government", label: "Airline travel" },
    { keyword: "charter flight government", label: "Charter flight" },
    { keyword: "ground transportation lodging", label: "Ground transportation" },
    // Construction and furnishing
    { keyword: "modular construction housing", label: "Modular construction" },
    { keyword: "prefab housing government", label: "Prefab housing" },
    // Insurance and specialty
    { keyword: "insurance housing government", label: "Insurance housing" },
    { keyword: "corporate housing", label: "Corporate housing" },
    { keyword: "executive housing government", label: "Executive housing" },
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

  // ── STEP 1: EXTRACT EXACT SOW REQUIREMENTS ─────────────────────────────────
  async function extractSOWRequirements(contract) {
    if (!ANTHROPIC_API_KEY) return null;
    const description = contract.description || contract.synopsis || "";
    const title = contract.title || contract.solicitationTitle || "";
    const city = contract.placeOfPerformance?.city?.name || "";
    const state = contract.placeOfPerformance?.state?.code || "";

    const prompt = `You are analyzing a US government contract for KD Modern Rentals LLC (WOSB housing contractor).

CONTRACT: ${title}
LOCATION: ${city}, ${state}
DESCRIPTION: ${description}

Extract EVERY requirement exactly as stated. Respond ONLY with valid JSON:

{
  "propType": "<hotel, apartment, cottage, RV park, vessel, event space, or other>",
  "totalUnitsOrRooms": <exact number or null>,
  "canSplitAcrossLocations": <true/false>,
  "splitRule": "<exact split rule from SOW>",
  "locations": [{"name": "<location>", "unitsNeeded": <number>, "radiusMiles": <number or null>, "radiusFrom": "<landmark>"}],
  "startDate": "<date or null>",
  "endDate": "<date or null>",
  "totalNights": <number or null>,
  "setAside": "<WOSB, Small Business, 8a, Unrestricted>",
  "evaluationMethod": "<LPTA or Best Value>",
  "estimatedValue": "<dollar amount or null>",
  "pocName": "<name or null>",
  "pocEmail": "<email or null>",
  "pocPhone": "<phone or null>",
  "altPocName": "<alt name or null>",
  "altPocEmail": "<alt email or null>",
  "altPocPhone": "<alt phone or null>",
  "requiresParking": <true/false>,
  "parkingSpacesNeeded": <exact number or null>,
  "parkingType": "<free, covered, valet, or any>",
  "requiresConferenceRoom": <true/false>,
  "conferenceCapacity": <exact number or null>,
  "requiresBreakoutRooms": <true/false>,
  "breakoutRoomCount": <number or null>,
  "requiresAV": <true/false>,
  "requiresCatering": <true/false>,
  "cateringDetails": "<exact details or null>",
  "requiresRestaurantOnSite": <true/false>,
  "requiresFullKitchen": <true/false>,
  "requiresKitchenette": <true/false>,
  "requiresLaundry": <true/false>,
  "laundryMustBeInUnit": <true/false>,
  "laundryCanBeOnSite": <true/false>,
  "requiresInRoomSafe": <true/false>,
  "requiresADA": <true/false>,
  "adaUnitsNeeded": <number or null>,
  "requiresWifi": <true/false>,
  "wifiType": "<standard, high-speed, dedicated, or null>",
  "requiresPool": <true/false>,
  "requiresFitnessCenter": <true/false>,
  "requiresBusinessCenter": <true/false>,
  "requiresAirportShuttle": <true/false>,
  "requiresEVCharging": <true/false>,
  "requiresPetsAllowed": <true/false>,
  "requiresDTS": <true/false>,
  "requiresIPP": <true/false>,
  "requiresAirfare": <true/false>,
  "airfareDetails": "<number of people, origin, destination or null>",
  "requiresFoodService": <true/false>,
  "foodServiceDetails": "<meals per day, dietary needs, etc or null>",
  "requiresFurniture": <true/false>,
  "bedTypes": ["<bed type 1>"],
  "minRating": 4.4,
  "requiresNonSmoking": true,
  "requiresFireSafe": true,
  "requiresBackgroundCheck": <true/false>,
  "requiresSecurityClearance": <true/false>,
  "additionalRequirements": ["<any other exact requirement>"]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("[KD] SOW extraction error:", err.message);
      return null;
    }
  }

  // ── STEP 2: BUILD COMPREHENSIVE VENDOR LIST ────────────────────────────────
  async function buildVendorList(sow, contractTitle, city, state) {
    if (!ANTHROPIC_API_KEY || !sow) return [];

    const locations = sow.locations?.length > 0
      ? sow.locations
      : [{ name: `${city}, ${state}`, unitsNeeded: sow.totalUnitsOrRooms || 5, radiusMiles: null, radiusFrom: "" }];

    const requirements = [];
    if (sow.totalUnitsOrRooms) requirements.push(`Needs exactly ${sow.totalUnitsOrRooms} units/rooms total`);
    if (sow.canSplitAcrossLocations) requirements.push(`CAN split: ${sow.splitRule}`);
    if (sow.parkingSpacesNeeded) requirements.push(`Parking: exactly ${sow.parkingSpacesNeeded} spaces (${sow.parkingType || "any type"})`);
    if (sow.requiresConferenceRoom) requirements.push(`Conference room for exactly ${sow.conferenceCapacity || "TBD"} people`);
    if (sow.requiresBreakoutRooms) requirements.push(`${sow.breakoutRoomCount || "multiple"} breakout rooms`);
    if (sow.requiresAV) requirements.push("AV equipment required");
    if (sow.requiresCatering) requirements.push(`Catering: ${sow.cateringDetails || "on-site catering required"}`);
    if (sow.requiresRestaurantOnSite) requirements.push("Restaurant on-site required");
    if (sow.laundryMustBeInUnit) requirements.push("IN-UNIT washer/dryer REQUIRED — on-site is not acceptable");
    if (sow.laundryCanBeOnSite && !sow.laundryMustBeInUnit) requirements.push("On-site laundry acceptable");
    if (sow.requiresInRoomSafe) requirements.push("In-room safe in EVERY unit");
    if (sow.requiresFullKitchen) requirements.push("Full kitchen required (stove, oven, full-size fridge, dishwasher)");
    if (sow.requiresKitchenette) requirements.push("Kitchenette minimum acceptable");
    if (sow.requiresADA) requirements.push(`${sow.adaUnitsNeeded || "some"} ADA accessible units required`);
    if (sow.wifiType) requirements.push(`${sow.wifiType} Wi-Fi required`);
    if (sow.requiresPool) requirements.push("Pool required");
    if (sow.requiresFitnessCenter) requirements.push("Fitness center required");
    if (sow.requiresAirportShuttle) requirements.push("Airport shuttle required");
    if (sow.requiresEVCharging) requirements.push("EV charging stations required");
    if (sow.requiresDTS) requirements.push("Must be DTS (Defense Travel System) compatible");
    if (sow.requiresAirfare) requirements.push(`Airfare needed: ${sow.airfareDetails || "verify in SOW"}`);
    if (sow.requiresFoodService) requirements.push(`Food service: ${sow.foodServiceDetails || "verify in SOW"}`);

    const locList = locations.map(l =>
      `- ${l.name}: ${l.unitsNeeded} units needed${l.radiusMiles ? `, within ${l.radiusMiles} miles of ${l.radiusFrom}` : ""}`
    ).join("\n");

    const prompt = `You are a government housing procurement specialist for KD Modern Rentals LLC (WOSB certified).

CONTRACT: ${contractTitle}
PROPERTY TYPE: ${sow.propType || "any accommodation"}

LOCATIONS:
${locList}

STRICT REQUIREMENTS — vendors MUST meet EVERY one of these exactly as stated:
${requirements.map((r, i) => `${i + 1}. ${r}`).join("\n") || "Standard government housing requirements"}

CRITICAL MATCHING RULES — DO NOT BEND THESE:
- If IN-UNIT laundry is required: ONLY include properties with washer/dryer inside the unit. Do NOT include on-site laundry as a substitute. Flag any property that only has on-site laundry as NOT meeting this requirement.
- If FULL KITCHEN is required: ONLY include properties with full stove, oven, full-size refrigerator, and dishwasher. A kitchenette does NOT qualify. Flag kitchenette-only properties as not meeting this requirement.
- If a KITCHENETTE is acceptable: include both full kitchens AND kitchenettes.
- If a specific NUMBER of rooms is required: ONLY include properties that can provide AT LEAST that exact number. If splitting is allowed, show exact allocation per property.
- If a specific PARKING count is required: ONLY include properties with AT LEAST that many spaces of the required type.
- If a CONFERENCE ROOM of specific capacity is required: ONLY include properties with a room that holds AT LEAST that many people.
- If a POOL is required: ONLY include properties with a pool. Mark pool as a BONUS if not required but available.
- If a FITNESS CENTER is required: ONLY include properties with one. Mark as BONUS if not required.
- If IN-ROOM SAFE is required: ONLY include properties with safes in EVERY room, OR include safe installation vendors.
- If ADA units are required: ONLY include properties with the exact number of ADA rooms needed.
- If DTS compatibility is required: ONLY include DTS-compatible properties.
- BONUS features: If a property has extras beyond what is required (pool, fitness center, business center, restaurant, EV charging, airport shuttle, spa, rooftop, lake view, concierge) flag these clearly as BONUS in the notes. These are selling points for your proposal.
- MINIMUM RATING: 4.4 stars on Google. No exceptions. Government officials must be in quality, safe locations.
- AREA QUALITY: Only suggest properties in safe, professional areas appropriate for government personnel.

BUILD THE MOST COMPREHENSIVE LIST POSSIBLE. For large cities aim for 100+ vendors. Include ALL of these categories if they could potentially fulfill the contract:

ACCOMMODATION TYPES TO SEARCH AND INCLUDE — be creative and comprehensive:
1. Hotels and motels (extended stay preferred: Residence Inn, Homewood Suites, TownePlace Suites, Staybridge Suites, Hyatt House, Candlewood Suites, Element, WoodSpring, Marriott, Hilton, Hyatt, IHG)
2. Furnished apartment complexes and corporate housing (National Corporate Housing, Furnished Quarters, CHBO, Blueground, Sonder, AvenueWest)
3. Vacation rentals and short-term rental management companies in the area
4. Bed and breakfasts and inns with multiple rooms
5. Cottages, cabins, and bungalows — include resort cottages
6. Mobile home and manufactured housing communities — include leasing director contact
7. RV parks and campgrounds — include park manager and leasing director
8. Tiny home communities and villages
9. Modular and prefab housing providers who can deploy quickly
10. VESSELS — cruise ships, large charter boats, houseboats, floating hotels docked at marinas near Navy/Coast Guard bases. Include harbor master contact. A docked vessel can fulfill sleeping rooms, dining, conference space, and security all in one location.
11. Marinas and yacht clubs that can accommodate large vessels with sleeping quarters
12. Waterfront properties and floating accommodations near military installations
13. University or college dorms and housing (available summers for government use)
14. Retirement communities with available guest or short-term units
15. Corporate retreat centers and conference centers with sleeping rooms
16. Large event venues with on-site sleeping accommodations
17. Real estate agents and leasing agents specializing in furnished and corporate rentals — include their direct line
18. Property management companies in the area — include leasing director
19. Furnished Finder, Airbnb for Work, VRBO corporate, Landing, Zeus Living
20. Insurance ALE (Additional Living Expense) housing networks — they have massive furnished housing rosters
21. Relocation companies who subcontract housing (Cartus, SIRVA, UniGroup, Graebel)
22. General contractors and construction companies who build or convert temporary housing
23. FEMA-approved housing providers and disaster housing specialists
24. Military base housing offices (Navy Lodge, Army Lodging, Air Force Inns) near the location
25. Hospital or medical center housing for staff — often has furnished units available

SPECIALTY VENDORS (include if SOW requires):
${sow.requiresInRoomSafe ? "- Safe installation: SafeGuard Business Systems 1-800-472-3636, American Security Products 1-800-421-6142, Gardall Safe Corp 1-800-722-7233" : ""}
${sow.requiresFurniture || sow.propType === "apartment" ? "- Furniture rental: CORT 1-888-360-2678, Brook Furniture 1-800-961-7346, AFR Furniture 1-888-737-4237, Margie at Flipper 1-808-428-1710 (Gov.Con contact), National Furniture Leasing 1-800-628-4422" : ""}
${sow.requiresCatering ? "- Catering companies in the area" : ""}
${sow.requiresAirfare ? "- Airlines serving the route: Delta 1-800-221-1212, United 1-800-864-8331, American 1-800-433-7300, Southwest 1-800-435-9792, charter flight companies" : ""}
${sow.requiresFoodService ? "- Food service providers, meal prep companies, grocery delivery" : ""}
- Construction companies if units need to be built or modified
- General contractors for rapid housing setup
- Home builders who do government contracts

Respond ONLY with valid JSON array. For large cities include 100+ vendors across all categories:
[
  {
    "locationGroup": "<which location this serves>",
    "vendorType": "<hotel, apartment, cottage, RV-park, mobile-home-park, vessel, tiny-home, event-space, real-estate-agent, property-manager, leasing-agent, furniture, safe-install, catering, airline, relocation, construction, marina, or other>",
    "name": "<exact business name>",
    "phone": "<real direct phone number — preferably leasing, group sales, or HR director line>",
    "contactTitle": "<Director of Leasing, Group Sales Manager, Harbor Master, HR Director, etc>",
    "address": "<full street address>",
    "city": "<city>",
    "state": "<state>",
    "rating": <Google rating or null>,
    "totalCapacity": <exact max rooms/units/slips this property can provide>,
    "canFulfillAlone": <true if this property alone meets full room requirement>,
    "unitsToBookHere": <exact units to book here — especially important if splitting>,
    "meetsAllRequirements": <true ONLY if every single requirement is met — be strict>,
    "requirementsMet": ["<exact requirement met>"],
    "requirementsMissing": ["<exact requirement NOT met — be specific>"],
    "hasInUnitLaundry": <true ONLY if washer/dryer is inside every unit>,
    "hasOnSiteLaundry": <true if shared laundry on property>,
    "laundryCompliant": <true if meets the contract laundry requirement exactly>,
    "hasFullKitchen": <true ONLY if stove + oven + full fridge + dishwasher>,
    "hasKitchenette": <true if microwave + mini fridge only>,
    "kitchenCompliant": <true if meets the contract kitchen requirement exactly>,
    "hasInRoomSafe": <true/false>,
    "hasConferenceRoom": <true/false>,
    "conferenceCapacity": <max conference room capacity or null>,
    "conferenceCompliant": <true if meets exact capacity requirement>,
    "hasBreakoutRooms": <true/false>,
    "breakoutRoomCount": <number or null>,
    "hasParking": <true/false>,
    "parkingSpaces": <number or null>,
    "parkingCompliant": <true if meets exact parking requirement>,
    "hasPool": <true/false>,
    "poolIsRequired": <true if pool was a contract requirement>,
    "hasFitnessCenter": <true/false>,
    "hasBusinessCenter": <true/false>,
    "hasRestaurant": <true/false>,
    "hasCatering": <true/false>,
    "hasAirportShuttle": <true/false>,
    "hasEVCharging": <true/false>,
    "hasSpa": <true/false>,
    "hasRooftop": <true/false>,
    "isADACompliant": <true/false>,
    "adaUnitsAvailable": <number or null>,
    "isDTSCompatible": <true/false>,
    "isExtendedStay": <true/false>,
    "isVessel": <true if this is a boat, ship, or floating accommodation>,
    "vesselDetails": "<vessel type, length, berths, docking location if applicable>",
    "bonusFeatures": ["<bonus feature not required but available — pool, gym, spa, rooftop bar, lake view, concierge, etc>"],
    "notes": "<why this is a strong match, any concerns, and unique selling points>",
    "callScript": "Hi, this is Kayla Deitte, owner of KD Modern Rentals LLC. We are a certified Women-Owned Small Business and SAM.gov registered government housing contractor, CAGE code 190G9. I am responding to a federal government RFP and need [EXACT NUMBER] [rooms/units/slips] from [START DATE] to [END DATE]. I need to confirm you have [KEY REQUIREMENTS]. I also need to verify your rating, laundry setup, kitchen type, and parking availability. Can I speak with your [leasing director/group sales/harbor master/government contracts coordinator]?"
  }
]`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("[KD] Vendor list error:", err.message);
      return [];
    }
  }

  // ── MAIN ENRICHMENT ────────────────────────────────────────────────────────
  async function enrichContract(contract) {
    if (!ANTHROPIC_API_KEY) return contract;
    const city = contract.placeOfPerformance?.city?.name || "";
    const state = contract.placeOfPerformance?.state?.code || "";
    console.log(`[KD] Enriching: ${(contract.title || "Unknown").slice(0, 50)}`);
    const sow = await extractSOWRequirements(contract);
    await delay(500);
    const vendorList = sow ? await buildVendorList(sow, contract.title || "", city, state) : [];
    return { ...contract, _enriched: true, _sowRequirements: sow, _vendorCallList: vendorList, _enrichedAt: new Date().toISOString() };
  }

  // ── RUN ALL SEARCHES ───────────────────────────────────────────────────────
  for (const search of searches) {
    const { label, ...params } = search;
    const results = await searchSAM(params, label);
    allContracts.push(...results);
    await delay(3000);
  }

  // Deduplicate
  const seen = new Set();
  const unique = allContracts.filter((c) => {
    const id = c.noticeId || c.solicitationNumber || JSON.stringify(c).slice(0, 50);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`[KD Scanner v12] Found ${unique.length} unique contracts across all searches`);
  console.log(`[KD] Errors: ${errors.length > 0 ? errors.map(e => `${e.label}: ${e.status || e.error}`).join(" | ") : "None"}`);

  // Enrich each contract
  const enriched = [];
  for (const contract of unique) {
    const enrichedContract = await enrichContract(contract);
    enriched.push(enrichedContract);
    await delay(1500);
  }

  console.log(`[KD Scanner v12] Enriched ${enriched.length} contracts with full SOW analysis and vendor lists`);

  // Save to Netlify Blobs
  try {
    const store = getStore("kd-contracts");
    await store.setJSON("latest-scan", {
      scan_time: new Date().toISOString(),
      contract_count: enriched.length,
      contracts: enriched,
    });
    console.log(`[KD Scanner v12] Saved ${enriched.length} contracts successfully`);
  } catch (err) {
    console.error("[KD Scanner v12] Save error:", err.message);
  }
};

export const config = {
  schedule: "0 */4 * * *",
};
// Note: FEMA and agency contacts are appended to vendor lists automatically
