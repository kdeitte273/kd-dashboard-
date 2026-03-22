import { getStore } from "@netlify/blobs";

export default async function getContracts(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore("kd-contracts");
    const data = await store.get("latest-scan", { type: "json" });

    if (!data) {
      return new Response(JSON.stringify({
        contracts: [],
        contract_count: 0,
        scan_time: null,
        message: "No scan data yet"
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({
      contracts: data.contracts || [],
      contract_count: data.contract_count || 0,
      scan_time: data.scan_time || null
    }), { status: 200, headers });

  } catch (err) {
    console.error("[KD] get-contracts error:", err.message);
    return new Response(JSON.stringify({
      contracts: [],
      contract_count: 0,
      error: err.message
    }), { status: 500, headers });
  }
}
