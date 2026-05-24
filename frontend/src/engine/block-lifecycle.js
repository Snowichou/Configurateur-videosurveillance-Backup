/**
 * engine/block-lifecycle.js — Cycle de vie des blocs caméra
 * PH4.4e — extrait de app.js
 *
 * Exports (factory):
 *   createBlockLifecycleHandlers(deps) => {
 *     rebuildAccessoryLinesFromBlocks,
 *     unvalidateBlock, invalidateIfNeeded,
 *     suggestAccessoriesForBlock, suggestAccessories,
 *     validateBlock
 *   }
 *
 * deps: {
 *   MODEL, CATALOG, uid, clampInt,
 *   getCameraById, scoreCameraForBlock,
 *   KPI, invalidateProjectCache
 * }
 */

export function createBlockLifecycleHandlers(deps = {}) {
  const {
    MODEL,
    CATALOG,
    uid,
    clampInt,
    getCameraById,
    scoreCameraForBlock,
    KPI,
    invalidateProjectCache,
  } = deps;

  function rebuildAccessoryLinesFromBlocks() {
    // Phase 2 — logique extraite dans src/engine/accessories.js
    MODEL.accessoryLines = window._buildAccessoryLinesPure(MODEL.cameraBlocks, MODEL.cameraLines);
  }

  function unvalidateBlock(block) {
    block.validated = false;

    if (block.validatedLineId) {
      const idx = MODEL.cameraLines.findIndex((l) => l.lineId === block.validatedLineId);
      if (idx >= 0) MODEL.cameraLines.splice(idx, 1);
    }
    block.validatedLineId = null;

    block.accessories = [];
    rebuildAccessoryLinesFromBlocks();
  }

  function invalidateIfNeeded(block) {
    try {
      invalidateProjectCache();
      if (!block) return;
      if (block.validated) {
        unvalidateBlock(block);
      }
    } catch (e) {
      console.warn('[invalidateIfNeeded] fallback', e);
      try { invalidateProjectCache(); } catch {}
    }
  }

  function suggestAccessoriesForBlock(block) {
    // Phase 2 — logique extraite dans src/engine/accessories.js
    const line = MODEL.cameraLines.find((l) => l.fromBlockId === block.id);
    const cam = line ? getCameraById(line.cameraId) : null;
    const mapRow = cam ? CATALOG.ACCESSORIES_MAP.get(cam.id) : null;
    block.accessories = window._computeBlockAccessoriesPure(
      {
        cam,
        mapRow,
        mounting: block.answers.mounting || 'wall',
        camQty: clampInt(line?.qty || 1, 1, 999),
      },
      { clampInt }
    );
  }

  function suggestAccessories() {
    for (const blk of (MODEL.cameraBlocks || [])) {
      if (!blk.validated) continue;
      suggestAccessoriesForBlock(blk);
    }
    rebuildAccessoryLinesFromBlocks();
  }

  function validateBlock(block, reco, forcedCameraId = null) {
    const chosenId = forcedCameraId || block.selectedCameraId || reco?.primary?.camera?.id || null;
    const cam = chosenId ? getCameraById(chosenId) : null;
    if (!cam) {
      alert('Impossible de valider : aucune cam\u00e9ra s\u00e9lectionnable pour ce bloc.');
      return;
    }

    const qty = clampInt(Number(block.qty || 1), 1, 999);
    block.qty = qty;

    const quality = block.quality || 'standard';

    if (block.validatedLineId) {
      const line = MODEL.cameraLines.find((l) => l.lineId === block.validatedLineId);
      if (line) {
        line.cameraId = cam.id;
        line.qty = qty;
        line.quality = quality;
        line.fromBlockId = block.id;
      } else {
        block.validatedLineId = null;
      }
    }

    if (!block.validatedLineId) {
      const lineId = uid('LINE');
      MODEL.cameraLines.push({ lineId, cameraId: cam.id, qty, quality, fromBlockId: block.id });
      KPI.sendNowait('validate_camera', KPI.snapshot());
      block.validatedLineId = lineId;
    }

    block.validated = true;
    block.selectedCameraId = cam.id;

    const sc = scoreCameraForBlock(block, cam);
    block.selectedCameraScore = sc.score;
    block.selectedCameraScoreParts = sc.parts;

    suggestAccessoriesForBlock(block);
    rebuildAccessoryLinesFromBlocks();
  }

  return {
    rebuildAccessoryLinesFromBlocks,
    unvalidateBlock,
    invalidateIfNeeded,
    suggestAccessoriesForBlock,
    suggestAccessories,
    validateBlock,
  };
}

window._createBlockLifecycleHandlers = createBlockLifecycleHandlers;
