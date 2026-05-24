// engine/kpi.js
// ✅ Phase 3 — PH3.6 : kpiConfigSnapshot extrait depuis app.js
// Snapshot des KPIs projet pour l'historique / l'export analytique.
// Fonction pure : prend proj + deps, retourne un objet sérialisable.

export function kpiConfigSnapshotPure(proj, deps = {}) {
  const {
    MODEL = {},
    getSelectedOrRecommendedScreen = null,
    getSelectedOrRecommendedEnclosure = null,
    getSelectedOrRecommendedSign = null,
  } = deps;

  try {
    const sp = proj?.storageParams || {};
    const rec = MODEL?.recording || {};

    // Caméras (liste + quantités)
    const cams = (proj?.perCamera || [])
      .map(r => ({
        id: r.cameraId,
        name: r.cameraName,
        qty: Number(r.qty || 0),
        mbpsPerCam: Number(r.mbpsPerCam || 0),
        mbpsLine: Number(r.mbpsLine || 0),
        source: r.mbpsSource || ""
      }))
      .filter(x => x.id && x.qty > 0);

    // Compléments
    const screenEnabled = !!(MODEL?.complements?.screen?.enabled);
    const enclosureEnabled = !!(MODEL?.complements?.enclosure?.enabled);
    const signageEnabled = !!(MODEL?.complements?.signage?.enabled ?? MODEL?.complements?.signage?.enable);

    // Ids choisis/reco (si tes helpers existent)
    const scrSel = (typeof getSelectedOrRecommendedScreen === "function")
      ? getSelectedOrRecommendedScreen(proj)?.selected
      : null;

    const encSel = (typeof getSelectedOrRecommendedEnclosure === "function")
      ? getSelectedOrRecommendedEnclosure(proj)?.selected
      : null;

    const signSel = (typeof getSelectedOrRecommendedSign === "function")
      ? getSelectedOrRecommendedSign()?.sign
      : null;

    return {
      projectName: String(proj?.projectName ?? MODEL?.projectName ?? "").trim() || null,

      // Résumé sizing
      totalCameras: Number(proj?.totalCameras || 0),
      totalInMbps: Number(proj?.totalInMbps || 0),
      requiredTB: Number(proj?.requiredTB || 0),

      // NVR / Switch
      nvrId: proj?.nvrPick?.nvr?.id || null,
      nvrName: proj?.nvrPick?.nvr?.name || null,
      switchesRequired: !!proj?.switches?.required,
      switchesPortsNeeded: Number(proj?.switches?.portsNeeded || 0) || null,
      switchesTotalPorts: Number(proj?.switches?.totalPorts || 0) || null,

      // Recording (source: proj.storageParams sinon MODEL.recording)
      recording: {
        daysRetention: sp.daysRetention ?? rec.daysRetention ?? null,
        hoursPerDay: sp.hoursPerDay ?? rec.hoursPerDay ?? null,
        overheadPct: sp.overheadPct ?? rec.overheadPct ?? null,
        codec: sp.codec ?? rec.codec ?? null,
        fps: sp.ips ?? rec.fps ?? null,
        mode: sp.mode ?? rec.mode ?? null,
      },

      // Caméras détaillées (top N pour éviter payload énorme)
      camerasTop: cams
        .sort((a, b) => (b.qty - a.qty))
        .slice(0, 30),

      // Compléments
      complements: {
        screen: {
          enabled: screenEnabled,
          qty: screenEnabled ? Number(MODEL?.complements?.screen?.qty || 1) : 0,
          id: scrSel?.id || null,
          name: scrSel?.name || null,
        },
        enclosure: {
          enabled: enclosureEnabled,
          qty: enclosureEnabled ? Number(MODEL?.complements?.enclosure?.qty || 1) : 0,
          id: encSel?.id || null,
          name: encSel?.name || null,
        },
        signage: {
          enabled: signageEnabled,
          qty: signageEnabled ? Number(MODEL?.complements?.signage?.qty || 1) : 0,
          id: signSel?.id || null,
          name: signSel?.name || null,
          scope: signageEnabled ? (MODEL?.complements?.signage?.scope || null) : null,
        },
      }
    };
  } catch {
    return { error: "snapshot_failed" };
  }
}

if (typeof window !== 'undefined') {
  window._kpiConfigSnapshotPure = kpiConfigSnapshotPure;
}
