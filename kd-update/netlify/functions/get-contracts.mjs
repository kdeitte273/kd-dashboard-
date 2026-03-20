// ── KD Modern Rentals — Contracts API ────────────────────────────────────────
// This endpoint is called by the dashboard to get the latest contracts
// Returns real SAM.gov data stored by the scanner function

import { getStore } from "@netlify/blobs";

export default async function getContracts(req, context) {
  // Allow CORS so the dashboard can call this
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore("kd-contracts");
    const data = await store.get("contracts", { type: "json" });

    if (!data) {
      // No data yet — scanner hasn't run or just deployed
      return new Response(JSON.stringify({
        contracts: [],
        lastUpdated: null,
        totalFound: 0,
        status: "pending",
        message: "Scanner hasn't run yet. Click Scan Now to trigger the first scan.",
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({
      ...data,
      status: "ok",
    }), { status: 200, headers });

  } catch (err) {
    console.error("[KD API] Error fetching contracts:", err.message);
    return new Response(JSON.stringify({
      contracts: [],
      lastUpdated: null,
      totalFound: 0,
      status: "error",
      message: "Error loading contracts: " + err.message,
    }), { status: 500, headers });
  }
}

export const config = {
  path: "/api/contracts",
};
