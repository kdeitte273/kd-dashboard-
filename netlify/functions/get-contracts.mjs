// ── KD Modern Rentals — Get Contracts from Supabase ──────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function getContracts(req) {
  const headers = {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});

  try {
    // Get contracts sorted by priority then deadline
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/contracts?select=*&order=priority.asc,deadline.asc&limit=500`,
      {headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`}}
    );
    if(!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const contracts = await res.json();

    // Get last scan time
    const logRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scan_log?id=eq.latest&select=*`,
      {headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`}}
    );
    const log = logRes.ok ? await logRes.json() : [];
    const lastScan = log[0] || {};

    return new Response(JSON.stringify({
      contracts,
      lastUpdated: lastScan.last_scanned || null,
      totalFound: contracts.length,
      status: contracts.length > 0 ? "ok" : "pending",
      message: contracts.length === 0 ? "No contracts yet — click Scan Now to trigger first scan" : null,
    }),{status:200,headers});

  } catch(err) {
    return new Response(JSON.stringify({contracts:[],lastUpdated:null,totalFound:0,status:"error",message:err.message}),{status:500,headers});
  }
}

export const config = { path: "/api/contracts" };
