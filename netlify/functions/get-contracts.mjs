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

    // ── NOTICE TYPE NORMALIZER ──────────────────────────────────────────────
    function normalizeNoticeType(raw) {
      if (!raw) return "solicitation";
      const s = raw.toLowerCase().replace(/[^a-z]/g, "");
      if (s.includes("combined")) return "combined_synopsis";
      if (s.includes("sourcessought") || s.includes("sources")) return "sources_sought";
      if (s.includes("presolicitation") || s.includes("presol")) return "pre_solicitation";
      if (s.includes("awardnotice") || (s.includes("award") && s.includes("notice"))) return "award_notice";
      if (s.includes("justification")) return "justification";
      if (s.includes("modification")) return "modification";
      if (s.includes("specialnotice") || (s.includes("special") && s.includes("notice"))) return "special_notice";
      if (s.includes("blanket")) return "blanket_purchase";
      if (s.includes("idiq")) return "idiq";
      if (s.includes("solicitation")) return "solicitation";
      return "solicitation";
    }

    // ── PROP TYPE DETECTOR ──────────────────────────────────────────────────
    function detectPropType(title, naics, sow) {
      const t = (title || "").toLowerCase();
      const n = String(naics || "");
      const s = JSON.stringify(sow || "").toLowerCase();
      if (n.startsWith("721") || t.includes("hotel") || t.includes("motel") ||
          t.includes("lodging") || t.includes("sleeping room") || t.includes("tdy")) return "hotel";
      if (t.includes("apartment") || t.includes("furnished") || t.includes("residential") ||
          t.includes("dwelling") || t.includes("housing") || n === "531110") return "apartment";
      if (s.includes("hotel") || s.includes("sleeping")) return "hotel";
      return "apartment";
    }

    // ── SET ASIDE NORMALIZER ────────────────────────────────────────────────
    function normalizeSetAside(raw) {
      if (!raw) return "Unrestricted";
      const s = raw.toLowerCase();
      if (s.includes("wosb") || s.includes("women-owned") || s.includes("women owned")) return "WOSB";
      if (s.includes("small business") && !s.includes("wosb")) return "Small Business";
      if (s.includes("sdvosb")) return "SDVOSB";
      if (s.includes("8(a)")) return "8(a)";
      if (s.includes("unrestricted") || s.includes("full and open")) return "Unrestricted";
      return raw;
    }

    // ── PRIORITY SCORER ─────────────────────────────────────────────────────
    // Returns 1 (highest) to 99 (lowest)
    function calcPriority(noticeType, setAside, deadline, profitPotential) {
      let score = 50;

      // Notice type weight
      const typeScore = {
        solicitation: 10,
        combined_synopsis: 12,
        sources_sought: 20,
        pre_solicitation: 30,
        blanket_purchase: 35,
        idiq: 35,
        award_notice: 80,
        special_notice: 85,
        justification: 88,
        modification: 90,
      };
      score = typeScore[noticeType] || 50;

      // Set aside boost — WOSB gets priority
      if (setAside === "WOSB") score -= 3;
      if (setAside === "Small Business") score -= 1;

      // Deadline urgency boost
      if (deadline) {
        const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
        if (days <= 7)  score -= 5;
        if (days <= 14) score -= 3;
        if (days <= 30) score -= 1;
      }

      // Profit potential boost
      if (profitPotential === "high")   score -= 4;
      if (profitPotential === "medium") score -= 2;

      return Math.max(1, score);
    }

    // ── PROFIT ESTIMATOR ────────────────────────────────────────────────────
    // Estimates monthly profit based on GSA rates and enrichment data
    const GSA_RATES = {
      // Key markets — lodging per night
      "WI": 140, "FL": 162, "AL": 126, "CA": 182, "NY": 296,
      "TX": 161, "GA": 130, "VA": 118, "MD": 153, "DC": 258,
      "CO": 167, "AZ": 127, "NV": 124, "WA": 205, "OR": 156,
      "NC": 128, "SC": 138, "TN": 160, "OH": 110, "IL": 200,
      "MN": 134, "MO": 110, "LA": 134, "OK": 110, "NM": 110,
    };

    function estimateMonthlyProfit(c, sow, state) {
      const gsaRate = GSA_RATES[state] || 110;
      const bidRate = Math.round(gsaRate * 0.98);
      const units = sow?.totalUnitsOrRooms || 5;
      const nights = sow?.estimatedNightsPerYear
        ? Math.round(sow.estimatedNightsPerYear / 12)
        : 20;
      const revenue = bidRate * units * nights;
      // Rough cost: 55% for apartments, 45% for hotels (subcontracted)
      const costPct = detectPropType(c.title, c.naicsCode) === "apartment" ? 0.55 : 0.45;
      const profit = Math.round(revenue * (1 - costPct));
      return profit;
    }

    // ── MAP CONTRACTS ───────────────────────────────────────────────────────
    const mapped = raw.map((c, i) => {
      const noticeType = normalizeNoticeType(c.type || c.baseType);
      const sow = c._sowRequirements || null;
      const state = c.placeOfPerformance?.state?.code || null;
      const city = c.placeOfPerformance?.city?.name || null;
      const setAside = normalizeSetAside(c.typeOfSetAsideDescription || sow?.setAside);
      const propType = detectPropType(c.title, c.naicsCode, sow);
      const noticeId = c.noticeId || c.solicitationNumber || String(i);
      const solNumber = c.solicitationNumber || c.noticeId || null;
      const profitPotential = sow?.profitPotential || "medium";
      const deadline = c.responseDeadLine || c.archiveDate || null;
      const estimatedProfit = estimateMonthlyProfit(c, sow, state);
      const priority = calcPriority(noticeType, setAside, deadline, profitPotential);

      // Build tags
      const tags = ["Real SAM.gov"];
      if (setAside && setAside !== "Unrestricted") tags.push(setAside);
      if (city) tags.push(city);
      if (state) tags.push(state);
      if (noticeType === "solicitation" || noticeType === "combined_synopsis") tags.push("BID NOW");
      if (noticeType === "sources_sought") tags.push("SEND CAP STMT");
      if (profitPotential === "high") tags.push("HIGH PROFIT");

      return {
        // IDs -- all formats so search works
        id: "sb_" + noticeId.replace(/[^a-zA-Z0-9]/g, "_"),
        notice_id: noticeId,
        solicitation_number: solNumber,
        sol: solNumber || noticeId,

        // Core fields
        title: c.title || c.solicitationTitle || "Untitled Contract",
        agency: c.fullParentPathName || c.department || "Unknown Agency",
        notice_type: noticeType,
        noticeType,
        city: city || "TBD",
        state: state || "",
        region: getRegion(state),
        propType,
        prop_type: propType,
        setAside,
        set_aside: setAside,
        naics: c.naicsCode || null,
        naics_code: c.naicsCode || null,

        // Dates
        deadline: deadline || "2099-01-01",
        posted_date: c.postedDate || null,
        moveInDate: null,

        // Scoring
        priority,
        rank: i + 1,
        profitPotential,
        estimatedMonthlyProfit: estimatedProfit,

        // Display
        value: sow?.estimatedAnnualValue
          ? "$" + Number(sow.estimatedAnnualValue).toLocaleString()
          : "Verify on SAM.gov",
        status: noticeType === "solicitation" || noticeType === "combined_synopsis"
          ? "Active Pursuit"
          : noticeType === "sources_sought"
          ? "Respond Now"
          : "On Radar",
        verified: true,
        realData: true,
        scannedIn: true,
        tags,

        // Links
        ui_link: c.uiLink || null,
        poc: sow?.pocEmail || "Verify on SAM.gov",

        // SOW
        description: c.description || null,
        sow: {
          units: sow?.totalUnitsOrRooms ? String(sow.totalUnitsOrRooms) + " units" : "Verify on SAM.gov",
          duration: "Verify on SAM.gov",
          location: [city, state].filter(Boolean).join(", ") || "TBD",
          amenities: [
            sow?.requiresWifi    ? "Wi-Fi"     : null,
            sow?.requiresKitchen ? "Kitchen"   : null,
            sow?.requiresParking ? "Parking"   : null,
            sow?.requiresLaundry ? "Laundry"   : null,
            sow?.requiresADA     ? "ADA units" : null,
          ].filter(Boolean),
          utilities: ["Electric", "Water", "Internet included"],
          requirements: [
            "Pull full SOW from SAM.gov — Notice ID " + noticeId,
            "Verify set-aside eligibility before bidding",
            "Check all attachments on SAM.gov",
          ],
          lodgingSchedule: {
            type: "continuous",
            typeLabel: "📅 Verify on SAM.gov",
            nightsPerYear: sow?.estimatedNightsPerYear || null,
            weeksPerYear: null,
            specificDates: "Pull from SAM.gov Notice ID " + noticeId,
            scheduleNotes: "Full schedule in SAM.gov solicitation documents.",
          },
        },

        // Extension placeholder
        extension: {
          extendable: false,
          options: 0,
          length: "N/A",
          totalDuration: "Verify on SAM.gov",
        },

        // Next action
        nextAction: c.uiLink
          ? "View full notice on SAM.gov: " + c.uiLink
          : "Search Notice ID " + noticeId + " on SAM.gov for full details.",
      };
    });

    // ── SORT: highest profit first within same priority tier ────────────────
    mapped.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.estimatedMonthlyProfit - a.estimatedMonthlyProfit;
    });

    return new Response(JSON.stringify(mapped), { status: 200, headers });

  } catch (err) {
    console.error("[KD] get-contracts error:", err.message);
    return new Response(JSON.stringify([]), { status: 500, headers });
  }
}

function getRegion(state) {
  const map = {
    WI:"Midwest", IL:"Midwest", MN:"Midwest", MI:"Midwest", OH:"Midwest",
    IN:"Midwest", MO:"Midwest", IA:"Midwest", ND:"Midwest", SD:"Midwest",
    NE:"Midwest", KS:"Midwest",
    FL:"Southeast", GA:"Southeast", AL:"Southeast", MS:"Southeast",
    SC:"Southeast", NC:"Southeast", TN:"Southeast", KY:"Southeast",
    VA:"Southeast", WV:"Southeast", AR:"Southeast",
    NY:"Northeast", NJ:"Northeast", PA:"Northeast", MA:"Northeast",
    CT:"Northeast", RI:"Northeast", NH:"Northeast", VT:"Northeast",
    ME:"Northeast", MD:"Northeast", DE:"Northeast", DC:"Northeast",
    TX:"Southwest", LA:"Southwest", OK:"Southwest", NM:"Southwest", AZ:"Southwest",
    CO:"Mountain/West", UT:"Mountain/West", NV:"Mountain/West",
    WY:"Mountain/West", MT:"Mountain/West", ID:"Mountain/West",
    CA:"Mountain/West", OR:"Mountain/West", WA:"Mountain/West",
    AK:"Mountain/West", HI:"Mountain/West",
  };
  return map[state] || "Other";
}
