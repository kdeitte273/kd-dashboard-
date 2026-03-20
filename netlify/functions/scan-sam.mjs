// ── KD Modern Rentals — SAM.gov Live Scanner → Supabase ──────────────────────
const SAM_API_KEY = process.env.SAM_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BASE_URL = "https://api.sam.gov/opportunities/v2/search";

const QUERIES = [
  "temporary housing","furnished housing","lodging","VA housing","seasonal housing",
  "fire housing","medical resident housing","transitional housing","relocation housing",
  "TDY lodging","hotel accommodations","extended stay","crew housing","emergency housing",
  "workforce housing","furnished apartment","cottage lodging","motor court","guest house","motel accommodations",
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
  const m={"WOSB":"WOSB","WOSBSS":"WOSB","SBA":"Small Business","SBP":"Small Business","8A":"8(a)","HZC":"HUBZone","HZS":"HUBZone","SDVOSBC":"SDVOSB","SDVOSBS":"SDVOSB","":"Unrestricted"};
  return m[code]||code||"Unrestricted";
}

function detectPropType(title,desc) {
  const t=((title||"")+" "+(desc||"")).toLowerCase();
  if(t.includes("hotel")||t.includes("motel")||t.includes("motor court")||t.includes("inn")||t.includes("tdy")||t.includes("lodging")) return "hotel";
  if(t.includes("apartment")||t.includes("furnished unit")||t.includes("residential")||t.includes("transitional")||t.includes("cottage")||t.includes("cabin")) return "apartment";
  return "mixed";
}

function detectRegion(s) {
  const r={"ME":"Northeast","NH":"Northeast","VT":"Northeast","MA":"Northeast","RI":"Northeast","CT":"Northeast","NY":"Northeast","NJ":"Northeast","PA":"Northeast","DE":"Northeast","MD":"Northeast","DC":"Northeast","WV":"Northeast","VA":"Southeast","NC":"Southeast","SC":"Southeast","GA":"Southeast","FL":"Southeast","AL":"Southeast","MS":"Southeast","TN":"Southeast","KY":"Southeast","AR":"Southeast","LA":"Southeast","WI":"Midwest","IL":"Midwest","MI":"Midwest","IN":"Midwest","OH":"Midwest","MN":"Midwest","IA":"Midwest","MO":"Midwest","ND":"Midwest","SD":"Midwest","NE":"Midwest","KS":"Midwest","TX":"Southwest","OK":"Southwest","NM":"Southwest","AZ":"Southwest","CO":"Mountain/West","UT":"Mountain/West","NV":"Mountain/West","ID":"Mountain/West","MT":"Mountain/West","WY":"Mountain/West","WA":"Mountain/West","OR":"Mountain/West","CA":"Mountain/West","AK":"Mountain/West","HI":"Mountain/West"};
  return r[s]||"Other";
}

function fmtDate(d){const x=new Date(d);return`${String(x.getMonth()+1).padStart(2,"0")}/${String(x.getDate()).padStart(2,"0")}/${x.getFullYear()}`;}
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function buildContract(opp) {
  const id=opp.noticeId||opp.solicitationNumber||"UNKNOWN";
  const pop=opp.placeOfPerformance||{};
  const city=pop.city?.name||"TBD";
  const state=pop.state?.code||"";
  const poc=opp.pointOfContact?.[0]||{};
  const noticeType=mapNoticeType(opp.type);
  const priority={solicitation:2,combined_synopsis:3,sources_sought:4,pre_solicitation:5,blanket_purchase:6,idiq:7,award_notice:8,special_notice:9,justification:10,modification:11};
  return {
    notice_id:id, sol:id, title:opp.title||"Untitled",
    agency:opp.fullParentPathName||"Federal Agency",
    naics:opp.naicsCode||"531110",
    set_aside:mapSetAside(opp.typeOfSetAsideDescription||opp.typeOfSetAside||""),
    notice_type:noticeType,
    prop_type:detectPropType(opp.title,opp.description),
    region:detectRegion(state), city, state,
    deadline:opp.responseDeadLine?new Date(opp.responseDeadLine).toISOString().split("T")[0]:null,
    published_date:opp.publishDate?new Date(opp.publishDate).toISOString().split("T")[0]:new Date().toISOString().split("T")[0],
    poc_email:poc.email||"Verify on SAM.gov",
    poc_name:poc.fullName||"",
    poc_phone:poc.phone||"",
    sam_url:`https://sam.gov/opp/${id}/view`,
    description:(opp.description||"").slice(0,500),
    verified:true, real_data:true,
    priority:priority[noticeType]||99,
    scanned_at:new Date().toISOString(),
  };
}

async function supabase(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify(body),
  });
  if(!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return true;
}

export default async function scanSAM() {
  if(!SAM_API_KEY||!SUPABASE_URL||!SUPABASE_KEY) {
    console.error("[KD Scanner] Missing environment variables");
    return {statusCode:500,body:"Missing environment variables"};
  }

  console.log(`[KD Scanner] Starting at ${new Date().toISOString()}`);
  const contracts=[], errors=[], seen=new Set();

  for(const query of QUERIES) {
    for(const naics of ["531110","721110"]) {
      try {
        const params=new URLSearchParams({api_key:SAM_API_KEY,limit:"10",q:query,ncode:naics,dmode:"0",postedFrom:fmtDate(daysAgo(90)),postedTo:fmtDate(new Date())});
        const res=await fetch(`${BASE_URL}?${params}`);
        if(!res.ok){errors.push(`"${query}" ${naics}: HTTP ${res.status}`);continue;}
        const data=await res.json();
        for(const opp of (data.opportunitiesData||[])) {
          const id=opp.noticeId||opp.solicitationNumber;
          if(!id||seen.has(id)) continue;
          const title=(opp.title||"").toLowerCase();
          const relevant=["housing","lodging","hotel","motel","apartment","furnished","temporary","tdy","transitional","relocation","seasonal","cottage","cabin","crew","emergency","workforce","guest house","motor court","inn","suite","extended stay"].some(k=>title.includes(k));
          if(relevant){seen.add(id);contracts.push(buildContract(opp));}
        }
        await sleep(200);
      } catch(err){errors.push(`"${query}" ${naics}: ${err.message}`);}
    }
  }

  console.log(`[KD Scanner] Found ${contracts.length} contracts`);
  try {
    if(contracts.length>0) await supabase("contracts",contracts);
    await supabase("scan_log",[{id:"latest",last_scanned:new Date().toISOString(),contracts_found:contracts.length,errors:errors.length,error_details:errors.slice(0,5).join("; ")}]);
    console.log(`[KD Scanner] Saved ${contracts.length} contracts to Supabase`);
  } catch(err) {
    console.error("[KD Scanner] Save failed:",err.message);
    return {statusCode:500,body:"Save failed: "+err.message};
  }

  return {statusCode:200,body:JSON.stringify({success:true,contractsFound:contracts.length,lastUpdated:new Date().toISOString(),errors:errors.length})};
}

export const config = { schedule: "*/15 * * * *" };
