// render/datasheet-urls.js
// ✅ Phase 3 — PH3.1 : collectDatasheetUrlsFromProject extraite depuis app.js
// Module ESM pur — dépendances injectées via deps

export function collectDatasheetUrlsFromProjectPure(proj, deps = {}) {
  const {
    MODEL,
    getCameraById,
    sanitizeFilename,
    localizedDatasheetUrl,
    dedupByUrl,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedSign,
  } = deps;
  const items = [];

  // Caméras
  for (const l of (MODEL.cameraLines || [])) {
    const cam = getCameraById(l.cameraId);
    if (cam?.datasheet_url) {
      items.push({
        url: cam.datasheet_url,
        path: `datasheets/cameras/${sanitizeFilename(cam.id)}.pdf`,
      });
    }
  }

  // NVR
  const nvr = proj?.nvrPick?.nvr;
  if (nvr?.datasheet_url) {
    items.push({
      url: nvr.datasheet_url,
      path: `datasheets/nvr/${sanitizeFilename(nvr.id)}.pdf`,
    });
  }

  // HDD (selon ton modèle: proj.disks.hddRef ou proj.disks.disk)
  const hdd = proj?.disks?.hddRef || proj?.disks?.disk || null;
  if (hdd?.datasheet_url) {
    items.push({
      url: hdd.datasheet_url,
      path: `datasheets/hdd/${sanitizeFilename(hdd.id)}.pdf`,
    });
  }

  // Switches
  for (const p of (proj?.switches?.plan || [])) {
    const sw = p?.item;
    if (sw?.datasheet_url) {
      items.push({
        url: sw.datasheet_url,
        path: `datasheets/switches/${sanitizeFilename(sw.id)}.pdf`,
      });
    }
  }

  // Accessoires (si tu as datasheet_url dans la ligne)
  for (const a of (MODEL.accessoryLines || [])) {
    if (a?.datasheet_url) {
      const id = a.accessoryId || a.id || "accessoire";
      items.push({
        url: a.datasheet_url,
        path: `datasheets/accessories/${sanitizeFilename(id)}.pdf`,
      });
    }
  }

  // Produits complémentaires (écran / boîtier / panneau si ton projet les expose)
  try {
    const scr = getSelectedOrRecommendedScreen(proj)?.selected || null;
    if (scr?.datasheet_url) {
      items.push({
        url: scr.datasheet_url,
        path: `datasheets/screens/${sanitizeFilename(scr.id)}.pdf`,
      });
    }
  } catch {}

  try {
    const enc = getSelectedOrRecommendedEnclosure(proj)?.selected || null;
    if (enc?.datasheet_url) {
      items.push({
        url: enc.datasheet_url,
        path: `datasheets/enclosures/${sanitizeFilename(enc.id)}.pdf`,
      });
    }
  } catch {}

  try {
    if (typeof getSelectedOrRecommendedSign === "function") {
      const sign = getSelectedOrRecommendedSign()?.sign || null;
      if (sign?.datasheet_url && MODEL?.complements?.signage?.enabled) {
        items.push({
          url: sign.datasheet_url,
          path: `datasheets/signage/${sanitizeFilename(sign.id)}.pdf`,
        });
      }
    }
  } catch {}

  // i18n: localiser toutes les URLs de fiches techniques selon la langue active
  const localizedItems = items.map(item => ({
    ...item,
    url: localizedDatasheetUrl(item.url)
  }));

  return dedupByUrl(localizedItems);
}

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
  window._collectDatasheetUrlsFromProjectPure = collectDatasheetUrlsFromProjectPure;
}
