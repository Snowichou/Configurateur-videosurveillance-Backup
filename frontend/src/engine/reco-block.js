/**
 * engine/reco-block.js — Helpers reco caméra par bloc
 * PH6.4 — extraits de app.js
 *
 * Exports:
 *   createRecoBlockHelpers(deps) — factory
 *     deps: { MODEL, toNum, recommendCameraForAnswers }
 *     returns: { canRecommendBlock, buildRecoForBlock }
 */

export function createRecoBlockHelpers(deps = {}) {
  const { MODEL, toNum, recommendCameraForAnswers } = deps;

  /**
   * Vérifie qu'un bloc a les réponses suffisantes pour déclencher une reco.
   * Requis : emplacement + objectif + distance > 0.
   */
  function canRecommendBlock(blk) {
    const ans = blk?.answers || {};
    const d = toNum(ans.distance_m);
    return !!ans.emplacement && !!ans.objective && Number.isFinite(d) && d > 0;
  }

  /**
   * Lance la reco caméra pour un bloc donné.
   * Retourne null si les réponses sont insuffisantes.
   */
  function buildRecoForBlock(blk) {
    if (!canRecommendBlock(blk)) return null;
    const ans = blk.answers;
    return recommendCameraForAnswers({
      use_case: ans.use_case || MODEL?.projectUseCase || "",
      emplacement: ans.emplacement,
      objective: ans.objective,
      distance_m: toNum(ans.distance_m),
    });
  }

  return { canRecommendBlock, buildRecoForBlock };
}

window._createRecoBlockHelpers = createRecoBlockHelpers;
