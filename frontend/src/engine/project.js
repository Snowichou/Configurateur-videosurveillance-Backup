// ============================================================
// engine/project.js -- Calcul complet du projet
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor -- PH2.21).
// computeProjectPure(deps) -> objet proj (NVR, stockage, alertes, score...)
//
// Deps injectees :
//   MODEL, CATALOG -- etat global et catalogue produits
//   T              -- traduction (i18n)
//   KPI            -- analytics (inoffensif si absent)
//   clampNum       -- utils/format
//   computeTotals  -- engine/totals (wrapper app.js)
//   getCameraById  -- state/lookups
//   getTotalCameras-- helper app.js (somme qty cameras)
//   mbpsToTB       -- engine/storage
//   pickDisks      -- engine/storage
//   pickNvr        -- engine/pick-nvr
//   planPoESwitches-- engine/poe
// ============================================================

export function computeProjectPure(deps = {}) {
  const {
    MODEL,
    CATALOG,
    T,
    KPI,
    clampNum,
    computeTotals,
    getCameraById,
    getTotalCameras,
    mbpsToTB,
    pickDisks,
    pickNvr,
    planPoESwitches,
  } = deps;


  const totalCameras = getTotalCameras();

  const totals = (typeof computeTotals === "function")
    ? computeTotals()
    : { totalInMbps: 0, totalPoeW: 0 };

  const totalPoeW = Number.isFinite(totals.totalPoeW) ? totals.totalPoeW : 0;

  const alerts = [];

  // -----------------------------
  // Réglages d'enregistrement (source de vérité)
  // -----------------------------
  const rec = MODEL?.recording || {};
  const hoursPerDay = clampNum(rec.hoursPerDay, 1, 24, 24);
  const daysRetention = clampNum(rec.daysRetention, 1, 365, 14);
  const overheadPct = clampNum(rec.overheadPct, 0, 100, 15);

  const ips = clampNum(rec.fps, 1, 60, 12);
  const codec = String(rec.codec || "H.265");
  const mode = String(rec.mode || T("pdf_continuous"));

  // -----------------------------
  // Débit par caméra : priorité bitrate_mbps_typical
  // -----------------------------
  const pickCamMbpsFromCatalog = (cam) => {
    if (!cam) return null;

    const candidates = [
      cam.bitrate_mbps_typical,
      cam.bitrate_mbps,
      cam.mbps,
      cam.bandwidth_mbps,
      cam.stream_mbps,
      cam.bitrate,
      cam.bandwidth,
    ];

    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const estimateCamMbpsFallback = (cam) => {
    let mp = Number(cam?.resolution_mp);
    if (!Number.isFinite(mp) || mp <= 0) mp = 4;

    const codecFactor = codec.toUpperCase().includes("265") ? 0.65 : 1.0;
    const baseAt12ips = mp * 1.2; // 4MP -> ~4.8 Mbps
    const mbps = baseAt12ips * (ips / 12) * codecFactor;

    return Math.max(0.6, Math.min(mbps, 16));
  };

  const perCamera = (MODEL.cameraLines || [])
    .map((l) => {
      const cam = (typeof getCameraById === "function") ? getCameraById(l.cameraId) : null;
      if (!cam) return null;

      const qty = Number(l.qty || 0);
      if (!qty) return null;

      const blk = (MODEL.cameraBlocks || []).find((b) => b.id === l.fromBlockId) || null;
      const blockLabel = blk?.label ? String(blk.label) : "";

      const catMbps = pickCamMbpsFromCatalog(cam);
      // Le catalogue donne le bitrate à 15fps H.265 continu — ajuster selon les paramètres
      let mbpsPerCam;
      if (catMbps != null) {
        let adjusted = catMbps;
        adjusted *= (ips / 15); // Le catalogue est normé à 15fps
        if (codec.toUpperCase().includes("264")) adjusted *= (1 / 0.65); // H.264 = +54% vs H.265
        if (mode === "motion") adjusted *= 0.40; // Détection = -60%
        mbpsPerCam = Math.max(0.5, adjusted);
      } else {
        mbpsPerCam = estimateCamMbpsFallback(cam);
      }

      return {
        fromBlockId: l.fromBlockId || null,
        blockLabel,
        cameraId: String(cam.id || ""),
        cameraName: String(cam.name || ""),
        qty,
        codec,
        ips,
        mbpsPerCam: Number(mbpsPerCam),
        mbpsLine: Number(mbpsPerCam) * qty,
        mbpsSource: catMbps != null ? "catalog" : "estimate",
      };
    })
    .filter(Boolean);

  const totalInMbps = perCamera.reduce((s, r) => s + (r.mbpsLine || 0), 0);
  const safeIn = Number.isFinite(totalInMbps) ? totalInMbps : 0;

  // -----------------------------
  // Calcul stockage AVANT sélection NVR (le stockage détermine les baies nécessaires)
  // -----------------------------
  const requiredTB = mbpsToTB(safeIn, hoursPerDay, daysRetention, overheadPct);

  // -----------------------------
  // Recos NVR (basé sur caméras + débit + stockage requis)
  // -----------------------------
  let nvrPick = pickNvr(totalCameras, safeIn, requiredTB);

  // Override NVR si l'utilisateur a choisi une alternative
  if (MODEL.overrideNvrId && CATALOG.NVRS) {
    const overrideNvr = CATALOG.NVRS.find(n => n.id === MODEL.overrideNvrId);
    if (overrideNvr) {
      const alts = CATALOG.NVRS
        .filter(n => (n.channels ?? 0) >= totalCameras && n.id !== overrideNvr.id)
        .sort((a, b) => (a.channels - b.channels) || ((a.max_in_mbps ?? 0) - (b.max_in_mbps ?? 0)))
        .slice(0, 3);
      nvrPick = { nvr: overrideNvr, reason: "Sélection manuelle — " + (overrideNvr.brand_range || ""), alternatives: alts };
    }
  }

  // Disks basés sur le NVR sélectionné
  const disks = nvrPick.nvr ? pickDisks(requiredTB, nvrPick.nvr) : null;

  // Switches
  const switches = planPoESwitches(totalCameras, rec.reservePortsPct, nvrPick.nvr);

  const swBudget = (switches.plan || []).reduce(
    (t, p) => t + (Number(p?.item?.poe_budget_w || 0) * (p.qty || 0)),
    0
  );

  if (swBudget > 0 && totalPoeW > swBudget) {
    alerts.push({
      level: "warn",
      text: `PoE total estimé ${totalPoeW.toFixed(0)}W > budget switches ${swBudget.toFixed(0)}W (à vérifier).`,
    });
  }

  // -----------------------------
  // Alerts
  // -----------------------------
  if (totalCameras <= 0) {
    alerts.push({
      level: "danger",
      text: T("err_validate_camera"),
    });
  }

  if (!nvrPick.nvr) {
    alerts.push({ level: "danger", text: T("err_no_nvr_csv") });
  }

  if (nvrPick.nvr && safeIn > Number(nvrPick.nvr.max_in_mbps || 0)) {
    alerts.push({
      level: "danger",
      text: `Débit total ${safeIn.toFixed(1)} Mbps > limite NVR (${nvrPick.nvr.max_in_mbps} Mbps).`,
    });
  }

  if (switches.required) {
    if (!CATALOG.SWITCHES.length) {
      alerts.push({
        level: "warn",
        text: "switches.csv non chargé : plan PoE généré avec valeurs génériques (4/8/16/24).",
      });
    }
    if (switches.totalPorts < switches.portsNeeded) {
      alerts.push({ level: "danger", text: "Plan switch PoE insuffisant (ports)." });
    }
  }

  if (disks && requiredTB > disks.maxTotalTB) {
    alerts.push({
      level: "danger",
      text: `${T("pdf_required_storage")} ~${requiredTB.toFixed(1)} TB > capacité max NVR (${disks.maxTotalTB} TB). Le stockage est bridé à ${disks.maxTotalTB} TB.`,
    });
  }

  // Brider le stockage effectif à la capacité max du NVR
  const storageCapped = disks && requiredTB > disks.maxTotalTB;
  const effectiveTB = storageCapped ? disks.maxTotalTB : requiredTB;

  // ✅ On construit l'objet projet
  const proj = {
    projectName: String(MODEL?.projectName || "").trim(),

    totalCameras,
    totalInMbps: safeIn,
    totalPoeW,
    nvrPick,
    switches,
    requiredTB: effectiveTB,
    rawRequiredTB: requiredTB,
    storageCapped,
    disks,
    alerts,

    perCamera,
    storageParams: {
      daysRetention,
      hoursPerDay,
      overheadPct,
      codec,
      ips,
      mode,
    },
  };

  // ✅ KPI "compute_project" (ne casse jamais l'app)
  try {
    // si tu as KPI.snapshot => top, sinon fallback simple
    if (typeof KPI?.snapshot === "function") {
      KPI.sendNowait("compute_project", KPI.snapshot(proj, { action: "compute" }));
    } else if (typeof KPI?.sendNowait === "function") {
      KPI.sendNowait("compute_project", {
        action: "compute",
        projectName: proj.projectName || null,
        totalCameras: proj.totalCameras,
        totalInMbps: proj.totalInMbps,
        requiredTB: proj.requiredTB,
        daysRetention: proj.storageParams?.daysRetention,
        hoursPerDay: proj.storageParams?.hoursPerDay,
        overheadPct: proj.storageParams?.overheadPct,
        codec: proj.storageParams?.codec,
        ips: proj.storageParams?.ips,
        mode: proj.storageParams?.mode,
        nvr_id: proj.nvrPick?.nvr?.id ?? null,
        switch_required: !!proj.switches?.required,
      });
    } else if (typeof KPI?.send === "function") {
      KPI.send("compute_project", {
        action: "compute",
        projectName: proj.projectName || null,
        totalCameras: proj.totalCameras,
        totalInMbps: proj.totalInMbps,
        requiredTB: proj.requiredTB,
        daysRetention: proj.storageParams?.daysRetention,
        hoursPerDay: proj.storageParams?.hoursPerDay,
        overheadPct: proj.storageParams?.overheadPct,
        codec: proj.storageParams?.codec,
        ips: proj.storageParams?.ips,
        mode: proj.storageParams?.mode,
        nvr_id: proj.nvrPick?.nvr?.id ?? null,
        switch_required: !!proj.switches?.required,
      });
    }
  } catch {
    // silence
  }

  return proj;
}
// -- Compat global --
if (typeof window !== 'undefined') {
  window._computeProjectPure = computeProjectPure;
}
