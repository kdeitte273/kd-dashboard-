// ── KD Modern Rentals — SAM.gov Live Scanner v2 ──────────────────────────────
// Fixed API parameters to match SAM.gov v2 search format correctly

const SAM_API_KEY = process.env.SAM_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// SAM.gov correct API endpoint
const BASE_URL = "https://api.sam.gov/opportunities/v2/search";

// Keywords that actually return results on SAM.gov
const KEYWORDS = [
  "temporary housing",
  "seasonal housing", 
  "lodging",
  "hotel",
  "motel",
  "furnished apartment",
  "transitional housing",
  "fire housing",
  "crew housing",
  "TDY lodging",
  "extended stay",
  "workforce housing",
  "medical resident housing",
  "relocation housing",
  "emergency housing",
  "cottage",
  "guest house",
];

function mapNoticeType(t) {
  t = (t||"").toUpperCase();
  if(t==="o"||t==="SOLICIT"||t.includes("SOLICITATION")) return "solicitation";
  if(t==="k"||t.includes("COMBINED")) return "combined_synopsis";
  if(t==="ss"||t.includes("SOURCES")) return "sources_sought";
  if(t==="p"||t.includes("PRESOL")) return "pre_solicitation";
  if(t==="a"||t.includes("AWARD")) return "award_notice";
  if(t==="s"||t.includes("SPECIAL")) return "special_notice";
  if(t==="j"||t.includes("JUSTIF")) return "justification";
  if(t==="m"||t.includes("MODIF")) return "modification";
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
  const id = opp.noticeId||opp.solicitationNumber||("UNK"+Date.now());
  const pop = opp.placeOfPerformance||{};
  const city = pop.city?.name||pop.city?.code||"TBD";
  const state = pop.state?.code||"";
  const poc = (opp.pointOfContact||[])[0]||{};
  const noticeType = mapNoticeType(opp.type||"");
  const priority = {solicitation:2,combined_synopsis:3,sources_sought:4,pre_solicitation:5,blanket_purchase:6,idiq:7,award_notice:8,special_notice:9,justification:10,modification:11};
  return {
    notice_id: id,
    sol: id,
    title: opp.title||"Untitled",
    agency: opp.fullParentPathName||opp.departmentName||"Federal Agency",
    naics: opp.naicsCode||(opp.naicsCodes&&opp.naicsCodes[0])||"531110",
    set_aside: mapSetAside(opp.typeOfSetAsideDescription||opp.typeOfSetAside||""),
    notice_type: noticeType,
    prop_type: ((opp.title||"").toLowerCase().includes("hotel")||(opp.title||"").toLowerCase().includes("motel")||(opp.title||"").toLowerCase().includes("lodg")||(opp.title||"").toLowerCase().includes("inn"))?"hotel":"apartment",
    region: detectRegion(state),
    city, state,
    deadline: opp.responseDeadLine?new Date(opp.responseDeadLine).toISOString().split("T")[0]:null,
    published_date: opp.publishDate?new Date(opp.publishDate).toISOString().split("T")[0]:new Date().toISOString().split("T")[0],
    poc_email: poc.email||"",
    poc_name: poc.fullName||poc.name||"",
    poc_phone: poc.phone||"",
    sam_url: `https://sam.gov/opp/${id}/view`,
    description: (opp.description||"").slice(0,500),
    verified: true,
    real_data: true,
    priority: priority[noticeType]||99,
    scanned_at: new Date().toISOString(),
  };
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

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
    throw new Error(`Supabase ${table}: ${r.status} ${txt}`);
  }
}

export default async function scanSAM() {
  if(!SAM_API_KEY||!SUPABASE_URL||!SUPABASE_KEY) {
    console.error("[KD] Missing env vars");
    return {statusCode:500,body:"Missing env vars"};
  }

  console.log(`[KD Scanner] Starting at ${new Date().toISOString()}`);
  const found=[], seen=new Set(), errors=[];

  // Get date 90 days ago in correct format for SAM.gov API
  const d = new Date();
  d.setDate(d.getDate()-90);
  const postedFrom = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  const today = new Date();
  const postedTo = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}/${today.getFullYear()}`;

  for(const keyword of KEYWORDS) {
    try {
      // SAM.gov v2 correct parameter format
      const url = `${BASE_URL}?api_key=${SAM_API_KEY}&q=${encodeURIComponent(keyword)}&limit=25&offset=0&postedFrom=${postedFrom}&postedTo=${postedTo}&status=active`;
      
      console.log(`[KD] Searching: ${keyword}`);
      const res = await fetch(url);
      
      if(!res.ok) {
        const txt = await res.text();
        errors.push(`${keyword}: HTTP ${res.status} — ${txt.slice(0,100)}`);
        continue;
      }
      
      const data = await res.json();
      const opps = data.opportunitiesData||data.opportunities||[];
      console.log(`[KD] "${keyword}" returned ${opps.length} results`);
      
      for(const opp of opps) {
        const id = opp.noticeId||opp.solicitationNumber;
        if(!id||seen.has(id)) continue;
        seen.add(id);
        found.push(buildContract(opp));
      }
      
      await sleep(300);
    } catch(e) {
      errors.push(`${keyword}: ${e.message}`);
      console.error(`[KD] Error on "${keyword}":`, e.message);
    }
  }

  console.log(`[KD Scanner] Found ${found.length} unique contracts. Errors: ${errors.length}`);
  if(errors.length) console.log("[KD] Errors:", errors.join(" | "));

  try {
    if(found.length>0) await supabaseUpsert("contracts", found);
    await supabaseUpsert("scan_log", [{
      id:"latest",
      last_scanned:new Date().toISOString(),
      contracts_found:found.length,
      errors:errors.length,
      error_details:errors.slice(0,3).join("; ")
    }]);
    console.log(`[KD Scanner] Saved ${found.length} contracts to Supabase`);
  } catch(e) {
    console.error("[KD Scanner] Save error:", e.message);
    return {statusCode:500,body:"Save error: "+e.message};
  }

  return {statusCode:200,body:JSON.stringify({success:true,found:found.length,errors:errors.length})};
}

export const config = { schedule: "*/15 * * * *" };
