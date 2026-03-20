// ── KD Modern Rentals — SAM.gov Live Scanner ─────────────────────────────────
// Runs every 15 minutes via Netlify scheduled function
// Searches SAM.gov API for real NAICS 531110 + 721110 contracts
// Saves results to Netlify Blobs so the dashboard can read them

import { getStore } from "@netlify/blobs";

const API_KEY = process.env.SAM_API_KEY;
const BASE_URL = "https://api.sam.gov/opportunities/v2/search";

// All NAICS codes we want to search
const NAICS_CODES = ["531110", "721110", "721191", "721199", "721211", "531190"];

// Set-asides to filter for (we want WOSB and open competitions)
const SET_ASIDES = ["SBA", "8A", "HZC", "HZS", "SBP", "SDVOSBC", "SDVOSBS", "WOSB", "WOSBSS", ""];

// Keywords to search — covers all contract types Kayla wants
const SEARCH_QUERIES = [
  "temporary housing",
  "furnished housing",
  "lodging",
  "VA housing",
  "seasonal housing",
  "fire housing",
  "medical resident housing",
  "transitional housing",
  "relocation housing",
  "TDY lodging",
  "hotel accommodations",
  "extended stay",
  "crew housing",
  "emergency housing",
  "workforce housing",
  "furnished apartment",
  "cottage lodging",
  "motor court",
  "guest house",
];

// Map SAM.gov notice types to our 7 contract types
function mapNoticeType(samType) {
  const t = (samType || "").toLowerCase();
  if (t.includes("solicitation") && t.includes("combined")) return "combined_synopsis";
  if (t.includes("solicitation") || t === "o") return "solicitation";
  if (t.includes("sources sought") || t === "ss") return "sources_sought";
  if (t.includes("presolicitation") || t.includes("pre-solicitation") || t === "p") return "pre_solicitation";
  if (t.includes("award") || t === "a") return "award_notice";
  if (t.includes("special") || t === "s") return "special_notice";
  if (t.includes("justification") || t === "j&a") return "justification";
  if (t.includes("modification") || t === "m") return "modification";
  if (t.includes("blanket") || t === "bpa") return "blanket_purchase";
  if (t.includes("idiq")) return "idiq";
  return "solicitation";
}

// Map set-aside codes to readable labels
function mapSetAside(code) {
  const map = {
    "WOSB": "WOSB",
    "WOSBSS": "WOSB",
    "SBA": "Small Business",
    "SBP": "Small Business",
    "8A": "8(a)",
    "HZC": "HUBZone",
    "HZS": "HUBZone",
    "SDVOSBC": "SDVOSB",
    "SDVOSBS": "SDVOSB",
    "": "Unrestricted",
  };
  return map[code] || code || "Unrestricted";
}

// Determine property type from title + description
function detectPropType(title, description) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  if (text.includes("hotel") || text.includes("motel") || text.includes("motor court") ||
      text.includes("inn") || text.includes("lodge") || text.includes("tdy") ||
      text.includes("lodging") || text.includes("conference")) return "hotel";
  if (text.includes("apartment") || text.includes("furnished unit") || text.includes("residential") ||
      text.includes("housing unit") || text.includes("dwelling") || text.includes("cottage") ||
      text.includes("cabin") || text.includes("transitional") || text.includes("relocation")) return "apartment";
  return "mixed";
}

// Determine region from state
function detectRegion(state) {
  const regions = {
    "ME":"Northeast","NH":"Northeast","VT":"Northeast","MA":"Northeast","RI":"Northeast",
    "CT":"Northeast","NY":"Northeast","NJ":"Northeast","PA":"Northeast","DE":"Northeast",
    "MD":"Northeast","DC":"Northeast","WV":"Northeast",
    "VA":"Southeast","NC":"Southeast","SC":"Southeast","GA":"Southeast","FL":"Southeast",
    "AL":"Southeast","MS":"Southeast","TN":"Southeast","KY":"Southeast","AR":"Southeast",
    "LA":"Southeast",
    "WI":"Midwest","IL":"Midwest","MI":"Midwest","IN":"Midwest","OH":"Midwest",
    "MN":"Midwest","IA":"Midwest","MO":"Midwest","ND":"Midwest","SD":"Midwest",
    "NE":"Midwest","KS":"Midwest",
    "TX":"Southwest","OK":"Southwest","NM":"Southwest","AZ":"Southwest",
    "CO":"Mountain/West","UT":"Mountain/West","NV":"Mountain/West","ID":"Mountain/West",
    "MT":"Mountain/West","WY":"Mountain/West","WA":"Mountain/West","OR":"Mountain/West",
    "CA":"Mountain/West","AK":"Mountain/West","HI":"Mountain/West",
  };
  return regions[state] || "Other";
}

// Build a clean contract object from SAM.gov API response
function buildContract(opp, index) {
  const noticeId = opp.noticeId || opp.solicitationNumber || "UNKNOWN";
  const title = opp.title || "Untitled Contract";
  const agency = opp.fullParentPathName || opp.organizationHierarchy?.[0]?.name || "Federal Agency";
  const office = opp.organizationHierarchy?.[opp.organizationHierarchy.length - 1]?.name || "";
  const naicsCode = opp.naicsCode || "531110";
  const setAsideCode = opp.typeOfSetAsideDescription || opp.typeOfSetAside || "";
  const setAside = mapSetAside(setAsideCode);
  const noticeType = mapNoticeType(opp.type);
  const deadline = opp.responseDeadLine || opp.archiveDate || null;
  const publishedDate = opp.publishDate || new Date().toISOString();
  const description = opp.description || "";
  const placeOfPerformance = opp.placeOfPerformance || {};
  const city = placeOfPerformance.city?.name || placeOfPerformance.city?.code || "TBD";
  const state = placeOfPerformance.state?.code || "";
  const propType = detectPropType(title, description);
  const region = detectRegion(state);

  // Extract POC info
  const poc = opp.pointOfContact?.[0] || {};
  const pocEmail = poc.email || "Verify on SAM.gov";
  const pocName = poc.fullName || poc.name || "";
  const pocPhone = poc.phone || "";

  // Determine action based on notice type
  const actionMap = {
    solicitation: "BID NOW",
    combined_synopsis: "BID NOW",
    sources_sought: "SEND CAP STMT",
    pre_solicitation: "WATCH & PREPARE",
    blanket_purchase: "APPLY FOR LIST",
    idiq: "WATCH & PREPARE",
    award_notice: "INTEL ONLY",
    special_notice: "SKIP",
    justification: "INTEL ONLY",
    modification: "INTEL ONLY",
  };

  // Priority for sorting
  const priorityMap = {
    solicitation: 2, combined_synopsis: 3, sources_sought: 4,
    pre_solicitation: 5, blanket_purchase: 6, idiq: 7,
    award_notice: 8, special_notice: 9, justification: 10, modification: 11,
  };

  return {
    id: `sam_${noticeId.replace(/[^a-zA-Z0-9]/g, "_")}`,
    rank: index + 1,
    scannedIn: true,
    verified: true,
    realData: true,
    noticeId,
    sol: noticeId,
    title,
    agency,
    office,
    naics: naicsCode,
    setAside,
    noticeType,
    propType,
    region,
    city,
    state,
    status: noticeType === "solicitation" ? "Active Pursuit" : noticeType === "sources_sought" ? "Respond Now" : "On Radar",
    deadline: deadline ? new Date(deadline).toISOString().split("T")[0] : "TBD",
    moveInDate: null,
    publishedDate: new Date(publishedDate).toISOString().split("T")[0],
    value: "Verify on SAM.gov",
    poc: pocEmail,
    pocName,
    pocPhone,
    samUrl: `https://sam.gov/opp/${opp.noticeId}/view`,
    nextAction: `${actionMap[noticeType] || "Review"} — Search Notice ID ${noticeId} on SAM.gov for full details, SOW, and requirements.`,
    description: description.slice(0, 500),
    tags: ["Real SAM.gov Data", setAside, city, state].filter(Boolean),
    extension: { extendable: false, options: 0, length: "N/A", totalDuration: "Verify on SAM.gov" },
    sow: {
      units: "Verify on SAM.gov",
      duration: "Verify on SAM.gov",
      location: `${city}${state ? ", " + state : ""}`,
      amenities: [],
      utilities: [],
      requirements: [
        "Pull full SOW from SAM.gov — search Notice ID " + noticeId,
        "Verify set-aside eligibility before bidding",
        "Check all attachments and amendments on SAM.gov",
      ],
      lodgingSchedule: {
        type: "continuous",
        typeLabel: "Verify on SAM.gov",
        nightsPerYear: null,
        weeksPerYear: null,
        specificDates: "Pull from SAM.gov Notice ID " + noticeId,
        scheduleNotes: "Full schedule details in SAM.gov solicitation documents.",
      },
    },
    priority: priorityMap[noticeType] || 99,
  };
}

// Deduplicate by notice ID
function deduplicateContracts(contracts) {
  const seen = new Set();
  return contracts.filter(c => {
    if (seen.has(c.noticeId)) return false;
    seen.add(c.noticeId);
    return true;
  });
}

// Main scanner function
export default async function scanSAM() {
  if (!API_KEY) {
    console.error("SAM_API_KEY not set in environment variables");
    return { statusCode: 500, body: "Missing API key" };
  }

  console.log(`[KD Scanner] Starting SAM.gov scan at ${new Date().toISOString()}`);

  const allContracts = [];
  const errors = [];

  for (const query of SEARCH_QUERIES) {
    for (const naics of ["531110", "721110"]) {
      try {
        const params = new URLSearchParams({
          api_key: API_KEY,
          limit: "10",
          q: query,
          ptype: "o,p,k,r,s,g,ss,sa", // all opportunity types
          ncode: naics,
          dmode: "0", // active only
          postedFrom: formatDate(daysAgo(90)), // last 90 days
          postedTo: formatDate(new Date()),
        });

        const url = `${BASE_URL}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          errors.push(`Query "${query}" NAICS ${naics}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const opportunities = data.opportunitiesData || [];

        opportunities.forEach((opp, i) => {
          // Only include housing/lodging related contracts
          const title = (opp.title || "").toLowerCase();
          const isRelevant = [
            "housing", "lodging", "hotel", "motel", "apartment", "furnished",
            "temporary", "tdy", "transitional", "relocation", "seasonal",
            "cottage", "cabin", "crew", "emergency", "workforce", "guest house",
            "motor court", "inn", "suite", "extended stay",
          ].some(keyword => title.includes(keyword));

          if (isRelevant) {
            allContracts.push(buildContract(opp, allContracts.length + i));
          }
        });

        // Rate limit — SAM.gov allows 10 requests/second
        await sleep(200);

      } catch (err) {
        errors.push(`Query "${query}" NAICS ${naics}: ${err.message}`);
      }
    }
  }

  // Deduplicate and sort by priority
  const unique = deduplicateContracts(allContracts);
  unique.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  console.log(`[KD Scanner] Found ${unique.length} unique contracts. ${errors.length} errors.`);

  // Save to Netlify Blobs so dashboard can read them
  try {
    const store = getStore("kd-contracts");
    await store.setJSON("contracts", {
      contracts: unique,
      lastUpdated: new Date().toISOString(),
      totalFound: unique.length,
      errors: errors.slice(0, 10), // save first 10 errors for debugging
      scanQueries: SEARCH_QUERIES.length * 2,
    });
    console.log(`[KD Scanner] Saved ${unique.length} contracts to Netlify Blobs`);
  } catch (err) {
    console.error("[KD Scanner] Failed to save to Blobs:", err.message);
    return { statusCode: 500, body: "Failed to save contracts: " + err.message };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      contractsFound: unique.length,
      lastUpdated: new Date().toISOString(),
      errors: errors.length,
    }),
  };
}

// Helper: format date as MM/DD/YYYY for SAM.gov API
function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// Helper: get date N days ago
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Helper: sleep for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Netlify scheduled function config — runs every 15 minutes
export const config = {
  schedule: "*/15 * * * *",
};
