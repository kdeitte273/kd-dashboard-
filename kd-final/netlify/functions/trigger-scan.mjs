// ── KD Modern Rentals — Manual Scan Trigger ──────────────────────────────────
// Called when you click "Scan Now" in the dashboard
// Triggers an immediate SAM.gov scan without waiting for the 15-min schedule

import scanSAM from "./scan-sam.mjs";

export default async function triggerScan(req, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
  }

  try {
    console.log("[KD Trigger] Manual scan triggered");
    const result = await scanSAM();
    return new Response(result.body, { status: result.statusCode, headers });
  } catch (err) {
    console.error("[KD Trigger] Error:", err.message);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), { status: 500, headers });
  }
}

export const config = {
  path: "/api/scan",
};
