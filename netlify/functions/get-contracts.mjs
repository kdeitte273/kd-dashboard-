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
      return new Response(JSON.stringify([]), { status: 200, headers });
    }

    const raw = data.contracts || [];

    const mapped = raw.map((c, i) => ({
      id: i + 1,
      notice_id: c.noticeId || c.solicitationNumber || String(i),
      title: c.title || c.solicitationTitle || "Untitled Contract",
      agency: c.fullParentPathName || c.department || "Unknown Agency",
      notice_type: c.type || c.baseType || "solicitation",
      city: c.placeOfPerformance?.city?.name || null,
      state: c.placeOfPerformance?.state?.code || null,
      deadline: c.responseDeadLine || c.archiveDate || null,
      posted_date: c.postedDate || null,
      set_aside: c.typeOfSetAsideDescription || null,
      naics_code: c.naicsCode || null,
      solicitation_number: c.solicitationNumber || null,
      ui_link: c.uiLink || null,
      description: c.description || null,
      priority: 3,
      status: "Open",
      tags: ["Real SAM.gov Data"],
      sow: c._sowRequirements || null,
      vendor_call_list: c._vendorCallList || [],
    }));

    return new Response(JSON.stringify(mapped), { status: 200, headers });

  } catch (err) {
    console.error("[KD] get-contracts error:", err.message);
    return new Response(JSON.stringify([]), { status: 500, headers });
  }
}
