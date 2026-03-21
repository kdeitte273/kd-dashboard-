import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    const store = getStore("kd-contracts");
    const data = await store.get("latest-scan", { type: "json" });

    if (!data) {
      return new Response(
        JSON.stringify({ contracts: [], scan_time: null, message: "No scan data yet. Scanner runs every 15 minutes." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[KD get-contracts] Error:", err.message);
    return new Response(
      JSON.stringify({ contracts: [], error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/contracts",
};
