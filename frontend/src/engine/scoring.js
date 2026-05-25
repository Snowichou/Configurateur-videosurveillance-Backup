// ============================================================
// engine/scoring.js — Helpers DORI & scoring caméra
// ============================================================
//
// Fonctions PURES extraites de app.js (Phase 1 refactor).
// Foundation pour le scoring conforme EN 62676-4.
//
// Exports :
//   - normalizeEmplacement(v)         : "interieur" | "exterieur" | ""
//   - objectiveToDoriKey(obj)         : nom de colonne DORI dans catalog
//   - getDoriForObjective(cam, obj)   : valeur DORI en mètres ou null
//   - getMpFromCam(cam)               : résolution MP ou null
//   - getIrFromCam(cam)               : portée IR en mètres ou null
//   - levelFromScore(score)           : { level: "OK"|"LIM"|"BAD", dot, label }
//   - levelFromScoreStrict(score)     : idem, level: "ok"|"warn"|"bad" (CSS)
//
// Le scoring complet (scoreCameraForBlock) reste dans app.js pour le moment
// (couplage avec CAMERA_PROFILES, à extraire en Phase 2).
// ============================================================

/**
 * Normalise une valeur d'emplacement en "interieur" / "exterieur" / "".
 * @param {*} v
 * @returns {"interieur"|"exterieur"|""}
 */
export function normalizeEmplacement(v) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s.startsWith('ext')) return 'exterieur';
  if (s.startsWith('int')) return 'interieur';
  return s || '';
}

/**
 * Mappe un objectif (DORI) vers le nom de colonne du catalogue.
 * @param {string} obj - "detection" | "observation" | "reconnaissance" | "identification"
 * @returns {string}
 */
export function objectiveToDoriKey(obj) {
  if (obj === 'detection') return 'dori_detection_m';
  if (obj === 'observation') return 'dori_observation_m';
  if (obj === 'reconnaissance') return 'dori_recognition_m';
  return 'dori_identification_m';
}

/**
 * Lit la valeur DORI d'une caméra pour un objectif donné.
 * Supporte le legacy "dissuasion" (mappé sur observation).
 * Accepte les valeurs CSV avec virgule décimale.
 *
 * @param {Object|null} cam
 * @param {string} objective - "detection" | "observation" | "reconnaissance" | "identification"
 * @returns {number|null} Mètres (> 0) ou null si non défini
 */
export function getDoriForObjective(cam, objective) {
  if (!cam) return null;

  let v = null;
  if (objective === 'detection') v = cam.dori_detection_m;
  else if (objective === 'observation') v = cam.dori_observation_m;
  else if (objective === 'reconnaissance') v = cam.dori_recognition_m;
  else if (objective === 'identification') v = cam.dori_identification_m;
  // Rétrocompat ancien "dissuasion"
  else if (objective === 'dissuasion') v = cam.dori_observation_m;
  else v = null;

  const num = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Lit la résolution caméra en mégapixels.
 * Accepte les valeurs CSV avec virgule décimale.
 *
 * @param {Object|null} cam
 * @returns {number|null}
 */
export function getMpFromCam(cam) {
  const num = Number(String(cam?.resolution_mp ?? '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

/**
 * Lit la portée IR caméra en mètres.
 * @param {Object|null} cam
 * @returns {number|null}
 */
export function getIrFromCam(cam) {
  const num = Number(String(cam?.ir_range_m ?? '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

/**
 * Convertit un score 0-100 en niveau qualitatif "pastille".
 * Seuils : OK ≥ 78, LIM ≥ 60, BAD < 60.
 *
 * @param {*} score
 * @returns {{level: "OK"|"LIM"|"BAD", dot: string, label: string}}
 */
export function levelFromScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) {
    return { level: 'LIM', dot: '\u{1F7E1}', label: 'LIM' };
  }
  if (s >= 78) return { level: 'OK', dot: '\u{1F7E2}', label: 'OK' };
  if (s >= 60) return { level: 'LIM', dot: '\u{1F7E1}', label: 'LIM' };
  return { level: 'BAD', dot: '\u{1F534}', label: 'BAD' };
}

/**
 * Variante de levelFromScore avec level "css-friendly" : ok / warn / bad.
 * @param {*} score
 * @returns {{level: "ok"|"warn"|"bad", dot: string, label: string}}
 */
export function levelFromScoreStrict(score) {
  const base = levelFromScore(score);
  const lvl = base.level === 'OK' ? 'ok' : base.level === 'LIM' ? 'warn' : 'bad';
  return { ...base, level: lvl };
}

// ─── Compat globals (legacy app.js) ─────────────────────────
if (typeof window !== 'undefined') {
}
