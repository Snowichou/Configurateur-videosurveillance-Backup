// ============================================================
// engine/totals.js — Débit / PoE / score critique du projet
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Logique métier pure.
//
// estimateCameraBitrateMbps : débit estimé d'une caméra selon le
//                             profil d'enregistrement (FPS, codec,
//                             mode) et la qualité demandée.
// computeTotals             : agrège débit entrant + conso PoE sur
//                             toutes les lignes caméra.
// computeCriticalProjectScore : score le plus faible parmi les
//                             blocs validés (axe 1 — solution
//                             critique).
//
// 100% pur : les données projet (lignes caméra, profil
// d'enregistrement, blocs) et le lookup catalogue sont passés en
// argument — aucun accès à un état global.
// ============================================================

/**
 * Débit estimé (Mbps) d'une caméra pour un profil d'enregistrement.
 *
 * @param {Object} camera  - fiche caméra ({ bitrate_mbps_typical, resolution_mp })
 * @param {Object} rec     - profil d'enregistrement ({ fps, codec, mode })
 * @param {string} quality - "low" | "standard" | "high"
 * @returns {number} débit en Mbps (plancher 0,5)
 */
export function estimateCameraBitrateMbps(camera, rec, quality) {
  let br = camera.bitrate_mbps_typical ?? (camera.resolution_mp ?? 4) * 1.2;
  br *= rec.fps / 15;
  if (rec.codec === 'h264') br *= 1.35;
  if (rec.mode === 'motion') br *= 0.4;

  const q = (quality || 'standard').toLowerCase();
  if (q === 'low') br *= 0.75;
  else if (q === 'high') br *= 1.2;

  return Math.max(0.5, br);
}

/**
 * Agrège le débit entrant total (Mbps) et la conso PoE totale (W)
 * sur l'ensemble des lignes caméra.
 *
 * @param {Array}  cameraLines - lignes caméra ({ cameraId, qty, quality })
 * @param {Object} recording   - profil d'enregistrement
 * @param {Object} [deps]
 * @param {Function} [deps.getCameraById] - (id) => caméra | null
 * @returns {{totalInMbps:number, totalPoeW:number}}
 */
export function computeTotals(cameraLines, recording, deps = {}) {
  const getCameraById =
    typeof deps.getCameraById === 'function' ? deps.getCameraById : () => null;
  const lines = Array.isArray(cameraLines) ? cameraLines : [];

  let totalInMbps = 0;
  let totalPoeW = 0;

  for (const line of lines) {
    const cam = getCameraById(line.cameraId);
    if (!cam) continue;
    const qty = line.qty || 0;
    totalPoeW += qty * (cam.poe_w ?? 0);
    const perCam = estimateCameraBitrateMbps(cam, recording, line.quality);
    totalInMbps += qty * perCam;
  }
  return { totalInMbps, totalPoeW };
}

/**
 * Score "solution critique" : le score le plus faible parmi les
 * blocs caméra validés.
 *
 * @param {Array} cameraBlocks - blocs ({ validated, selectedCameraScore })
 * @returns {number|null} le pire score, ou null si aucun bloc validé
 */
export function computeCriticalProjectScore(cameraBlocks) {
  let worst = null;

  for (const blk of cameraBlocks || []) {
    if (!blk.validated) continue;

    const s = Number(blk.selectedCameraScore);
    if (!Number.isFinite(s)) continue;

    if (worst === null || s < worst) {
      worst = s;
    }
  }

  return worst; // null si aucun bloc validé
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  window._estimateCameraBitrateMbpsPure = estimateCameraBitrateMbps;
  window._computeTotalsPure = computeTotals;
  window._computeCriticalProjectScorePure = computeCriticalProjectScore;
}
