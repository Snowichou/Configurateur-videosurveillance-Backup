// ============================================================
// state/lookups.js — Lookups catalogue (purs)
// ============================================================
//
// Fonctions PURES extraites de app.js (Phase 2 refactor).
// Toutes prennent le catalogue concerné en paramètre — aucune
// dépendance à CATALOG global ou à MODEL.
//
// Exports :
//   - findById(items, id)           : O(n) helper générique
//   - getCameraById(id, cameras)    : caméra par id ou null
//   - getNvrById(id, nvrs)
//   - getHddById(id, hdds)
//   - getSwitchById(id, switches)
//   - getScreenById(id, screens)
//   - getEnclosureById(id, enclosures)
//   - getAllUseCases(cameras)       : liste triée des use_cases du catalogue
// ============================================================

import { isFalseLike } from '../utils/format.js';

/**
 * Helper générique : trouve un élément par id dans un tableau.
 * @param {Array<{id?: string}>} items
 * @param {*} id
 * @returns {Object|null}
 */
export function findById(items, id) {
  if (!Array.isArray(items) || id == null || id === '') return null;
  return items.find((it) => it && it.id === id) || null;
}

/** Lookup caméra par id. */
export const getCameraById = (id, cameras) => findById(cameras, id);

/** Lookup NVR par id. */
export const getNvrById = (id, nvrs) => findById(nvrs, id);

/** Lookup HDD par id. */
export const getHddById = (id, hdds) => findById(hdds, id);

/** Lookup Switch par id. */
export const getSwitchById = (id, switches) => findById(switches, id);

/** Lookup Screen par id. */
export const getScreenById = (id, screens) => findById(screens, id);

/** Lookup Enclosure par id. */
export const getEnclosureById = (id, enclosures) => findById(enclosures, id);

/**
 * Liste dédupliquée et triée (locale FR) de tous les use_cases présents
 * dans le catalogue caméras.
 *
 * @param {Array<{use_cases?: string[]}>} cameras
 * @returns {string[]}
 */
export function getAllUseCases(cameras) {
  const set = new Set();
  for (const c of cameras || []) {
    for (const u of c?.use_cases || []) {
      if (!isFalseLike(u)) set.add(String(u).trim());
    }
  }
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
}

// ─── Compat globals (legacy app.js) ─────────────────────────
if (typeof window !== 'undefined') {
}
