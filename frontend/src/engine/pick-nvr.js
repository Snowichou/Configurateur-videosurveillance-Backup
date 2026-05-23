// ============================================================
// engine/pick-nvr.js — Moteur de sélection NVR
// ============================================================
//
// Fonction PURE extraite de app.js (Phase 1 refactor).
//
// Règle métier centrale :
//   - Si AU MOINS UN bloc caméra demande IA ADVANCE → le NVR DOIT être ADVANCE
//     (préservation IA : comptage, métadonnées, LPR…)
//   - Sinon → NEXT prioritaire (moins cher), auto-upgrade ADVANCE si NEXT
//     n'a pas assez de canaux (NEXT max = 16 ch).
//
// Exports :
//   - pickNvr(totalCameras, totalInMbps, requiredTB, cameraBlocks,
//             catalogNvrs, catalogHdds, [tFn])
//     → { nvr, reason, alternatives, otherRangeAlternatives,
//         requiredRange, usedRange, upgradedFromNext, hasAdvanceBlock }
//
// Exposé sur window pour rétro-compat avec l'IIFE app.js.
// ============================================================

/**
 * Identité (i18n) par défaut quand aucune fonction de traduction n'est fournie.
 * @param {string} key
 * @returns {string}
 */
const identityT = (key) => key;

/**
 * Sélectionne le meilleur NVR pour un projet donné.
 *
 * Critère de scoring (par ordre) :
 *   1. Couvre le nombre de canaux requis (filtre dur)
 *   2. Score = baysOk (×1000) + mbpsOk (×10)
 *   3. À score égal : nombre de canaux minimal (éviter l'overspending)
 *
 * @param {number} totalCameras       - Nombre total de caméras
 * @param {number} totalInMbps        - Débit total entrant (Mbps)
 * @param {number} requiredTB         - Stockage requis (To)
 * @param {Array<Object>} cameraBlocks - Blocs caméra (lecture ai_type)
 * @param {Array<Object>} catalogNvrs - Catalogue NVRs (brand_range, channels, max_in_mbps, hdd_bays)
 * @param {Array<Object>} catalogHdds - Catalogue HDDs (pour calculer minBays)
 * @param {Function} [tFn=identityT]  - Fonction de traduction i18n (optionnelle)
 * @returns {Object}
 */
export function pickNvr(
  totalCameras,
  totalInMbps,
  requiredTB,
  cameraBlocks,
  catalogNvrs,
  catalogHdds,
  tFn = identityT
) {
  const T = typeof tFn === 'function' ? tFn : identityT;

  // ── 1. Déterminer la gamme requise ──────────────────────────
  const blocks = Array.isArray(cameraBlocks) ? cameraBlocks : [];
  const hasAdvanceBlock = blocks.some(
    (b) => String(b?.answers?.ai_type || '').toLowerCase() === 'advance'
  );
  const requiredRange = hasAdvanceBlock ? 'ADVANCE' : 'NEXT';

  // ── 2. Calculer le minimum de baies HDD nécessaires ─────────
  const hdds = Array.isArray(catalogHdds) ? catalogHdds : [];
  const hddSizes = [...new Set(hdds.map((h) => h.capacity_tb).filter((x) => Number.isFinite(x)))].sort(
    (a, b) => b - a
  );
  const biggestHdd = hddSizes[0] || 8;
  const minBays = requiredTB > 0 ? Math.ceil(requiredTB / biggestHdd) : 1;

  // ── 3. Helper scoring ───────────────────────────────────────
  const scoreCandidates = (list) =>
    list
      .filter((n) => (n.channels ?? 0) >= totalCameras)
      .sort((a, b) => a.channels - b.channels || (a.max_in_mbps ?? 0) - (b.max_in_mbps ?? 0))
      .map((nvr) => {
        const baysOk = (nvr.hdd_bays ?? 0) >= minBays;
        const mbpsOk = (nvr.max_in_mbps ?? 0) >= totalInMbps;
        const score = (baysOk ? 1000 : 0) + (mbpsOk ? 10 : 0);
        return { nvr, score, baysOk, mbpsOk };
      })
      .sort((a, b) => b.score - a.score || a.nvr.channels - b.nvr.channels);

  // ── 4. Pool prioritaire : NVRs de la gamme requise ──────────
  const nvrs = Array.isArray(catalogNvrs) ? catalogNvrs : [];
  const sameRangeOnly = nvrs.filter((n) => (n.brand_range || '').toUpperCase() === requiredRange);
  let scored = scoreCandidates(sameRangeOnly);
  let usedRange = requiredRange;
  let upgradedFromNext = false;

  // ── 5. Fallback NEXT → ADVANCE si NEXT est insuffisant ─────
  if (!scored.length && requiredRange === 'NEXT') {
    const advanceFallback = nvrs.filter((n) => (n.brand_range || '').toUpperCase() === 'ADVANCE');
    scored = scoreCandidates(advanceFallback);
    if (scored.length) {
      usedRange = 'ADVANCE';
      upgradedFromNext = true;
    }
  }

  // ── 6. Aucun NVR ne couvre les canaux ───────────────────────
  if (!scored.length) {
    return {
      nvr: null,
      reason: `${T('err_no_nvr_channels')} (besoin ≥ ${totalCameras} canaux)`,
      alternatives: [],
      requiredRange,
      hasAdvanceBlock,
    };
  }

  // ── 7. Construire la justification (reason) ─────────────────
  const best = scored[0];
  const reasons = [`Gamme ${best.nvr.brand_range || usedRange}`];
  if (hasAdvanceBlock) reasons.push('imposée par bloc IA ADVANCE');
  else if (upgradedFromNext) reasons.push('upgrade auto NEXT→ADVANCE (capacité NEXT max 16 ch)');
  if (best.baysOk) reasons.push('stockage couvert');
  else reasons.push('⚠️ baies HDD insuffisantes');
  if (best.mbpsOk) reasons.push('débit OK');
  else reasons.push('débit à vérifier');

  // ── 8. Alternatives (même gamme d'abord, puis autre gamme) ──
  const sameRangeAlts = scored
    .filter((s) => s.nvr.id !== best.nvr.id)
    .slice(0, 3)
    .map((s) => s.nvr);
  const otherRangeAlts = nvrs
    .filter(
      (n) =>
        (n.brand_range || '').toUpperCase() !== usedRange && (n.channels ?? 0) >= totalCameras
    )
    .slice(0, 2);

  return {
    nvr: best.nvr,
    reason: reasons.join(' — '),
    alternatives: sameRangeAlts,
    otherRangeAlternatives: otherRangeAlts,
    requiredRange,
    usedRange,
    upgradedFromNext,
    hasAdvanceBlock,
  };
}

// ─── Compat global (legacy app.js) ──────────────────────────
// Le wrapper dans app.js injecte CATALOG.NVRS / CATALOG.HDDS / MODEL.cameraBlocks / T.
if (typeof window !== 'undefined') {
  window._pickNvrPure = pickNvr;
}
