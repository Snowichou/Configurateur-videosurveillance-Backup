/**
 * engine/sanity.js — Normalisation/garde-fous de l'état MODEL
 * PH4.4f — extrait de app.js
 *
 * Exports:
 *   sanityPure(deps)
 *
 * deps: { MODEL, createEmptyCameraBlock, applyDemoClass }
 */

export function sanityPure(deps = {}) {
  const { MODEL, createEmptyCameraBlock, applyDemoClass } = deps;

  if (!Array.isArray(MODEL.cameraBlocks) || MODEL.cameraBlocks.length === 0) {
    MODEL.cameraBlocks = [createEmptyCameraBlock()];
  }
  if (!MODEL.ui) MODEL.ui = {};

  // Champs UI requis (safe defaults)
  if (!MODEL.ui.activeBlockId && MODEL.cameraBlocks[0]) MODEL.ui.activeBlockId = MODEL.cameraBlocks[0].id;
  if (typeof MODEL.ui.resultsShown !== 'boolean') MODEL.ui.resultsShown = false;
  if (MODEL.ui.mode !== 'simple' && MODEL.ui.mode !== 'expert') MODEL.ui.mode = 'simple';
  if (typeof MODEL.ui.demo !== 'boolean') MODEL.ui.demo = false;
  if (typeof MODEL.ui.onlyFavs !== 'boolean') MODEL.ui.onlyFavs = false;
  if (!Array.isArray(MODEL.ui.favorites)) MODEL.ui.favorites = [];
  if (!Array.isArray(MODEL.ui.compare)) MODEL.ui.compare = [];
  if (!MODEL.ui.previewByBlock || typeof MODEL.ui.previewByBlock !== 'object') MODEL.ui.previewByBlock = {};

  // Dé-doublonnage + garde-fous
  MODEL.ui.favorites = Array.from(new Set(MODEL.ui.favorites.map(String)));
  MODEL.ui.compare = Array.from(new Set(MODEL.ui.compare.map(String))).slice(0, 2);

  // Nettoyage preview (si bloc supprimé)
  const blockIds = new Set((MODEL.cameraBlocks || []).map(b => b.id));
  for (const k of Object.keys(MODEL.ui.previewByBlock || {})) {
    if (!blockIds.has(k)) delete MODEL.ui.previewByBlock[k];
  }

  applyDemoClass();
}

window._sanityPure = sanityPure;
