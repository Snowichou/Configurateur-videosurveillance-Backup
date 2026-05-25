// ============================================================
// engine/pick-nvr.js — Moteur de sélection NVR
// ============================================================
//
// Fonction PURE extraite de app.js (Phase 2 refactor).
//
// Algorithme « gamme dominante » (canonique, décision Seb) :
//   1. On déduit la gamme dominante = celle (NEXT / ADVANCE) la plus
//      représentée parmi les caméras configurées.
//   2. On filtre les NVRs couvrant le nombre de canaux requis.
//   3. Scoring souple : baies HDD OK (×1000) > même gamme que la
//      dominante (×100) > débit OK (×10).
//   4. À score égal : nombre de canaux minimal (anti-surdimensionnement).
//
// 100% pur : lignes caméra, lookup catalogue, catalogues NVR/HDD et
// i18n passés via `deps`. Le wrapper app.js injecte ses dépendances
// → comportement strictement identique au legacy.
// ============================================================

const identityT = (key) => String(key ?? '');

/**
 * Sélectionne le meilleur NVR pour un projet donné.
 *
 * @param {number} totalCameras - Nombre total de caméras
 * @param {number} totalInMbps  - Débit total entrant (Mbps)
 * @param {number} requiredTB   - Stockage requis (To)
 * @param {Object} [deps]
 * @param {Array}    [deps.cameraLines]   - lignes caméra ({ cameraId, qty })
 * @param {Function} [deps.getCameraById] - (id) => caméra | null
 * @param {Array}    [deps.catalogNvrs]   - catalogue NVRs
 * @param {Array}    [deps.catalogHdds]   - catalogue HDDs (pour minBays)
 * @param {Function} [deps.T]             - i18n
 * @returns {{nvr:Object|null, reason:string, alternatives:Object[]}}
 */
export function pickNvr(totalCameras, totalInMbps, requiredTB, deps = {}) {
  const cameraLines = Array.isArray(deps.cameraLines) ? deps.cameraLines : [];
  const getCameraById =
    typeof deps.getCameraById === 'function' ? deps.getCameraById : () => null;
  const catalogNvrs = Array.isArray(deps.catalogNvrs) ? deps.catalogNvrs : [];
  const catalogHdds = Array.isArray(deps.catalogHdds) ? deps.catalogHdds : [];
  const T = typeof deps.T === 'function' ? deps.T : identityT;

  // Déterminer la gamme dominante des caméras configurées
  const rangeCounts = {};
  for (const l of cameraLines) {
    const cam = getCameraById(l?.cameraId);
    const r = cam?.brand_range || 'NEXT';
    rangeCounts[r] = (rangeCounts[r] || 0) + (Number(l?.qty || 0) || 0);
  }
  const dominantRange =
    Object.entries(rangeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NEXT';

  // Calculer le nombre minimum de baies nécessaires
  const hddSizes = [
    ...new Set(catalogHdds.map((h) => h.capacity_tb).filter((x) => Number.isFinite(x))),
  ].sort((a, b) => b - a);
  const biggestHdd = hddSizes[0] || 8;
  const minBays = requiredTB > 0 ? Math.ceil(requiredTB / biggestHdd) : 1;

  const candidates = catalogNvrs
    .filter((n) => (n.channels ?? 0) >= totalCameras)
    .sort((a, b) => a.channels - b.channels || (a.max_in_mbps ?? 0) - (b.max_in_mbps ?? 0));

  // Score chaque candidat
  const scored = candidates
    .map((nvr) => {
      const baysOk = (nvr.hdd_bays ?? 0) >= minBays;
      const mbpsOk = (nvr.max_in_mbps ?? 0) >= totalInMbps;
      const sameRange = (nvr.brand_range || '').toUpperCase() === dominantRange.toUpperCase();
      // Priorité : baies OK > même gamme > débit OK
      const score = (baysOk ? 1000 : 0) + (sameRange ? 100 : 0) + (mbpsOk ? 10 : 0);
      return { nvr, score, baysOk, mbpsOk, sameRange };
    })
    .sort((a, b) => b.score - a.score || a.nvr.channels - b.nvr.channels);

  if (!scored.length) return { nvr: null, reason: T('err_no_nvr_channels'), alternatives: [] };

  const best = scored[0];
  const reasons = [];
  if (best.sameRange) reasons.push('Gamme ' + (best.nvr.brand_range || ''));
  if (best.baysOk) reasons.push('stockage couvert');
  else reasons.push('⚠️ baies HDD insuffisantes');
  if (best.mbpsOk) reasons.push('débit OK');
  else reasons.push('débit à vérifier');

  const alternatives = scored
    .filter((s) => s.nvr.id !== best.nvr.id)
    .slice(0, 3)
    .map((s) => s.nvr);

  return { nvr: best.nvr, reason: reasons.join(' — '), alternatives };
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
