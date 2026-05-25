// ============================================================
// engine/accessories.js — Sélection des accessoires de fixation
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Logique métier pure.
//
// computeBlockAccessories : pour une caméra + un type de pose, liste
//                           les accessoires (boîtier de jonction +
//                           support mural/plafond) avec quantités.
// buildAccessoryLines     : aplatit les accessoires de tous les blocs
//                           validés en lignes d'accessoires projet.
//
// 100% pur : aucune lecture de MODEL/CATALOG ni de DOM. Les wrappers
// app.js font les lookups (ligne caméra, fiche caméra, ligne de
// mapping accessoires) et passent les données au module.
// ============================================================

import { clampInt as defaultClampInt } from '../utils/format.js';

/**
 * Calcule les lignes d'accessoires d'un bloc caméra.
 *
 * Règles : boîtier de jonction systématique (si présent), puis
 * support selon la pose (plafond / mur), avec repli sur l'autre
 * support si le support attendu n'existe pas. Quantité = qty caméra
 * × multiplicateur de la ligne de mapping. Dédoublonnage par
 * type+accessoryId.
 *
 * @param {Object} args
 * @param {Object|null} args.cam      - fiche caméra (cam.id requis)
 * @param {Object|null} args.mapRow   - ligne de mapping accessoires
 *        ({ junction, wall, ceiling, qty })
 * @param {string} [args.mounting]    - "wall" | "ceiling"
 * @param {number} [args.camQty=1]    - quantité de caméras du bloc
 * @param {Object} [deps]
 * @returns {Array<Object>} lignes d'accessoires (dédupliquées)
 */
export function computeBlockAccessories({ cam, mapRow, mounting, camQty = 1 } = {}, deps = {}) {
  const clampInt = typeof deps.clampInt === 'function' ? deps.clampInt : defaultClampInt;
  if (!cam || !mapRow) return [];

  const picked = [];

  // Boîtier de jonction systématiquement (si présent)
  if (mapRow.junction?.id) picked.push(mapRow.junction);

  // Support selon la pose
  let mountAcc = null;
  if (mounting === 'ceiling') mountAcc = mapRow.ceiling?.id ? mapRow.ceiling : null;
  else mountAcc = mapRow.wall?.id ? mapRow.wall : null;

  // Repli si le support attendu n'existe pas
  if (!mountAcc) {
    mountAcc =
      (mapRow.wall?.id ? mapRow.wall : null) || (mapRow.ceiling?.id ? mapRow.ceiling : null);
  }
  if (mountAcc?.id) picked.push(mountAcc);

  const mult = clampInt(mapRow.qty, 1, 999);
  const lines = picked.map((acc) => ({
    type: acc.type,
    accessoryId: acc.id,
    name: acc.name || acc.id,
    qty: camQty * mult,
    image_url: acc.image_url || false,
    datasheet_url: acc.datasheet_url || false,
    stand_alone: !!acc.stand_alone,
    linkedCameraId: cam.id,
  }));

  // Dédoublonnage par type + accessoryId
  const agg = new Map();
  for (const l of lines) {
    const key = `${l.type}__${l.accessoryId}`;
    const prev = agg.get(key);
    if (!prev) agg.set(key, { ...l });
    else prev.qty += l.qty;
  }

  return [...agg.values()].filter((x) => x.accessoryId && x.qty > 0);
}

/**
 * Aplatit les accessoires de tous les blocs caméra validés en lignes
 * d'accessoires au niveau projet.
 *
 * @param {Array} cameraBlocks - blocs caméra ({ validated, accessories, id })
 * @param {Array} cameraLines  - lignes caméra ({ fromBlockId, cameraId })
 * @returns {Array<Object>} lignes d'accessoires projet
 */
export function buildAccessoryLines(cameraBlocks, cameraLines) {
  const out = [];
  const lines = Array.isArray(cameraLines) ? cameraLines : [];

  for (const blk of cameraBlocks || []) {
    if (!blk.validated) continue;
    const camLine = lines.find((l) => l.fromBlockId === blk.id);
    const camId = camLine?.cameraId || null;

    for (const accLine of blk.accessories || []) {
      out.push({
        type: accLine.type,
        accessoryId: accLine.accessoryId,
        name: accLine.name,
        qty: accLine.qty,
        linkedCameraId: accLine.linkedCameraId || camId || null,
        fromBlockId: blk.id,
        image_url: accLine.image_url || false,
        datasheet_url: accLine.datasheet_url || false,
        stand_alone: !!accLine.stand_alone,
      });
    }
  }

  return out;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
