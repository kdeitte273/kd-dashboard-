// ── KD Modern Rentals — SAM.gov Live Scanner v3 FIXED ────────────────────────
// Key fixes:
// 1. Correct production URL: api.sam.gov/PROD/opportunities/v2/search
// 2. Use "title" parameter not "q" (no keyword search in SAM API)
// 3. Search by NAICS code directly for broader results
// 4. Multiple search strategies to maximize results

const SAM_API_KEY = process.env.SAM_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// CORRECT production URL with /prod/ path
const BASE_URL = "https://api.sam.gov/prod/opportunities/v2/search";

// Title keywords to search — SAM API searches within titles only
const TITLE_SEARCHES = [
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

// NAICS codes to search directly — most reliable method
const NAICS_SEARCHES = [
  "531110", // Lessors of Residential Buildings
  "721110", // Hotels and Motels
  "721191", // Bed and Breakfast Inns
  "721199", // All Other Traveler Accommodation (cottages, cabins)
  "721211", // RV Parks and Campgrounds
  "531190", // Lessors of Other Real Estate Property
];

function mapNoticeType(t) {
  t = (t||"").toLowerCase();
  if(t.includes("combined")) return "combined_synopsis";
  if(t.includes("solicitation")||t==="o") return "solicitation";
  if(t.includes("sources sought")||t==="ss") return "sources_sought";
  if(t.includes("presolicitation")||t==="p") return "pre_solicitation";
  if(t.includes("award")||t==="a") return "award_notice";
  if(t.includes("special")||t==="s") return "special_notice";
  if(t.includes("justification")) return "justification";
  if(t.includes("modification")) return "modification";
  return "solicitation";
}

function mapSetAside(code) {
  const m={
    "WOSB":"WOSB","WOSBSS":"WOSB","SBA":"Small Business","SBP":"Small Business",
    "8A":"8(a)","8AN":"8(a)","HZC":"HUBZone","HZS":"HUBZone",
    "SDVOSBC":"SDVOSB","SDVOSBS":"SDVOSB","VSA":"SDVOSB","VSB":"SDVOSB",
    "EDWOSB":"WOSB","ESA":"Small Business","":" Unrestricted"
  };
  return m[code]||code||"Unrestricted";
}

function detectRegion(s) {
  const r={
    "ME":"Northeast","NH":"Northeast","VT":"Northeast","MA":"Northeast","RI":"Northeast",
    "CT":"Northeast","NY":"Northeast","NJ":"Northeast","PA":"Northeast","DE":"Northeast",
    "MD":"Northeast","DC":"Northeast","WV":"Northeast",
    "VA":"Southeast","NC":"Southeast","SC":"Southeast","GA":"Southeast","FL":"Southeast",
    "AL":"Southeast","MS":"Southeast","TN":"Southeast","KY":"Southeast","AR":"Southeast","LA":"Southeast",
    "WI":"Midwest","IL":"Midwest","MI":"Midwest","IN":"Midwest","OH":"Midwest",
    "MN":"Midwest","IA":"Midwest","MO":"Midwest","ND":"Midwest","SD":"Midwest","NE":"Midwest","KS":"Midwest",
    "TX":"Southwest","OK":"Southwest","NM":"Southwest","AZ":"Southwest",
    "CO":"Mountain/West","UT":"Mountain/West","NV":"Mountain/West","ID":"Mountain/West",
    "MT":"Mountain/West","WY":"Mountain/West","WA":"Mountain/West","OR":"Mountain/West",
    "CA":"Mountain/West","AK":"Mountain/West","HI":"Mountain/West",
  };
  return r[s]||"Other";
}

function buildContract(opp) {
  const id = opp.noticeId||opp.solicitationNumber||("UNK"+Date.now()+Math.random());
  const pop = opp.placeOfPerformance||{};
  const city = pop.city?.name||pop.city?.code||"TBD";
  const state = pop.state?.code||"";
  const poc = (opp.pointOfContact||[])[0]||{};
  const noticeType = mapNoticeType(opp.type||"");
  const priority = {
    solicitation:2,combined_synopsis:3,sources_sought:4,pre_solicitation:5,
    blanket_purchase:6,idiq:7,award_notice:8,special_notice:9,justification:10,modification:11
  };
  const title = (opp.title||"").toLowerCase();
  const propType = (title.includes("hotel")||title.includes("motel")||title.includes("lodg")||
    title.includes("inn")||title.includes("tdy")||title.includes("guest house"))?"hotel":"apartment";

  return {
    notice_id: id.toString().slice(0,100),
    sol: (opp.solicitationNumber||id).toString().slice(0,100),
    title: (opp.title||"Untitled").slice(0,500),
    agency: (opp.fullParentPathName||opp.departmentName||"Federal Agency").slice(0,500),
    naics: (opp.naicsCode||(opp.naicsCodes&&opp.naicsCodes[0])||"531110").toString(),
    set_aside: mapSetAside(opp.typeOfSetAsideDescription||opp.typeOfSetAside||""),
    notice_type: noticeType,
    prop_type: propType,
    region: detectRegion(state),
    city, state,
    deadline: opp.responseDeadLine?new Date(opp.responseDeadLine).toISOString().split("T")[0]:null,
    published_date: opp.postedDate||opp.publishDate?new Date(opp.postedDate||opp.publishDate).toISOString().split("T")[0]:new Date().toISOString().split("T")[0],
    poc_email: (poc.email||"").slice(0,200),
    poc_name: (poc.fullName||poc.name||"").slice(0,200),
    poc_phone: (poc.phone||"").slice(0,50),
    sam_url: `https://sam.gov/opp/${id}/view`,
    description: (opp.description||"").slice(0,500),
    verified: true,
    real_data: true,
    priority: priority[noticeType]||99,
    scanned_at: new Date().toISOString(),
  };
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function getDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate()-90);
  const fmt = d => `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  return {from: fmt(from), to: fmt(to)};
}

async function searchSAM(params) {
  const {from, to} = getDateRange();
  const url = new URL(BASE_URL);
  url.searchParams.set("api_key", SAM_API_KEY);
  url.searchParams.set("limit", "25");
  url.searchParams.set("postedFrom", from);
  url.searchParams.set("postedTo", to);
  // Only active opportunities
  url.searchParams.set("status", "active");
  
  // Add search-specific params
  for(const [k,v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if(!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
  }
  const data = await res.json();
  // SAM API returns opportunitiesData array
  return data.opportunitiesData || data.opportunities || [];
}

async function supabaseUpsert(table, rows) {
  if(!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":SUPABASE_KEY,
      "Authorization":`Bearer ${SUPABASE_KEY}`,
      "Prefer":"resolution=merge-duplicates,return=minimal"
    },
    body:JSON.stringify(rows),
  });
  if(!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${table}: ${r.status} — ${txt.slice(0,200)}`);
  }
}

export default async function scanSAM() {
  if(!SAM_API_KEY||!SUPABASE_URL||!SUPABASE_KEY) {
    console.error("[KD] Missing env vars — check SAM_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY in Netlify");
    return {statusCode:500,body:"Missing env vars"};
  }

  console.log(`[KD Scanner v3] Starting at ${new Date().toISOString()}`);
  const found=[], errors=[], seen=new Set();

  // Strategy 1: Search by NAICS code — most reliable
  console.log("[KD] Strategy 1: NAICS code searches");
  for(const naics of NAICS_SEARCHES) {
    try {
      const opps = await searchSAM({ncode: naics});
      console.log(`[KD] NAICS ${naics}: ${opps.length} results`);
      for(const opp of opps) {
        const id = opp.noticeId||opp.solicitationNumber;
        if(!id||seen.has(id)) continue;
        seen.add(id);
        found.push(buildContract(opp));
      }
      await sleep(400);
    } catch(e) {
      errors.push(`NAICS ${naics}: ${e.message}`);
      console.error(`[KD] NAICS ${naics} error:`, e.message);
    }
  }

  // Strategy 2: Title keyword searches
  console.log("[KD] Strategy 2: Title keyword searches");
  for(const keyword of TITLE_SEARCHES) {
    try {
      const opps = await searchSAM({title: keyword});
      console.log(`[KD] Title "${keyword}": ${opps.length} results`);
      for(const opp of opps) {
        const id = opp.noticeId||opp.solicitationNumber;
        if(!id||seen.has(id)) continue;
        seen.add(id);
        found.push(buildContract(opp));
      }
      await sleep(400);
    } catch(e) {
      errors.push(`Title "${keyword}": ${e.message}`);
      console.error(`[KD] Title "${keyword}" error:`, e.message);
    }
  }

  console.log(`[KD Scanner v3] Total unique contracts found: ${found.length}`);
  if(errors.length) console.log("[KD] Errors:", errors.slice(0,5).join(" | "));

  try {
    if(found.length>0) {
      // Save in batches of 50 to avoid size limits
      for(let i=0; i<found.length; i+=50) {
        await supabaseUpsert("contracts", found.slice(i, i+50));
      }
    }
    await supabaseUpsert("scan_log", [{
      id:"latest",
      last_scanned:new Date().toISOString(),
      contracts_found:found.length,
      errors:errors.length,
      error_details:errors.slice(0,3).join("; ")
    }]);
    console.log(`[KD Scanner v3] Saved ${found.length} contracts to Supabase`);
  } catch(e) {
    console.error("[KD Scanner v3] Save error:", e.message);
    return {statusCode:500,body:"Save error: "+e.message};
  }

  return {
    statusCode:200,
    body:JSON.stringify({success:true,found:found.length,errors:errors.length})
  };
}

export const config = { schedule: "*/15 * * * *" };
