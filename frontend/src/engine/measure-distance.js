// ============================================================
// engine/measure-distance.js — Mesure DORI par photo + gyroscope
// ============================================================
//
// Fonctions PURES (aucun accès DOM / capteur). Elles convertissent
// l'orientation d'un téléphone (DeviceOrientationEvent) en angle de
// plongée, puis appliquent la trigonométrie :
//
//        distance_horizontale = hauteur_montage / tan(plongée)
//
// L'installateur se place à l'emplacement de la caméra, saisit la
// hauteur de montage, puis incline le téléphone vers la zone au sol.
// L'angle de plongée (sous l'horizontale) donne la distance.
//
// Conventions DeviceOrientationEvent (référentiel appareil) :
//   - beta  : rotation avant/arrière (axe X), -180..180.
//             ≈ 90° quand le dos de l'appareil vise l'horizon (vertical),
//             ≈ 0°  quand l'appareil est à plat, dos vers le sol.
//   - gamma : rotation gauche/droite (axe Y), -90..90.
//             Utilisé en mode paysage où beta n'est plus pertinent.
//
//   plongée_portrait = 90 - beta
//   plongée_paysage  = 90 - |gamma|
//
// Exports :
//   - MEASURE_LIMITS                          : bornes physiques
//   - depressionFromOrientation({beta,gamma,orientation}) : angle (°) ou null
//   - computeGroundDistance({heightM,depressionDeg})      : {distanceM,reason}
//   - measureFromPhone({heightM,beta,gamma,orientation})  : combinaison
// ============================================================

/**
 * Bornes physiques de la mesure.
 * @readonly
 */
export const MEASURE_LIMITS = Object.freeze({
  minDepressionDeg: 1, // sous ce seuil → quasi-horizon → distance diverge
  maxDistanceM: 999, // borne alignée sur l'input distance_m (1..999)
  minHeightM: 0.1,
  maxHeightM: 50,
});

/**
 * Détecte un mode paysage à partir d'une valeur d'orientation libre.
 * Accepte "landscape", "landscape-primary", 90, -90, "90"...
 * @param {*} orientation
 * @returns {boolean}
 */
function isLandscape(orientation) {
  if (typeof orientation === 'number') return Math.abs(orientation) === 90;
  const s = String(orientation ?? '').toLowerCase();
  if (s.startsWith('landscape')) return true;
  if (s === '90' || s === '-90' || s === '270') return true;
  return false;
}

/**
 * Convertit l'orientation appareil en angle de plongée (degrés sous
 * l'horizontale). Valeur brute NON bornée : computeGroundDistance se
 * charge de classer les cas hors-plage (vers le haut, trop plat...).
 *
 * @param {Object} o
 * @param {number} [o.beta]   - DeviceOrientationEvent.beta
 * @param {number} [o.gamma]  - DeviceOrientationEvent.gamma
 * @param {string|number} [o.orientation='portrait'] - screen.orientation.type ou angle
 * @returns {number|null} angle de plongée en degrés, ou null si données absentes
 */
export function depressionFromOrientation({ beta = null, gamma = null, orientation = 'portrait' } = {}) {
  if (isLandscape(orientation)) {
    const g = gamma == null || gamma === '' ? NaN : Number(gamma);
    if (!Number.isFinite(g)) return null;
    return 90 - Math.abs(g);
  }
  const b = beta == null || beta === '' ? NaN : Number(beta);
  if (!Number.isFinite(b)) return null;
  return 90 - b;
}

/**
 * Applique la trigonométrie pour obtenir la distance horizontale au sol.
 *
 * Codes `reason` :
 *   - null            : mesure valide (distanceM exploitable)
 *   - 'invalid_height': hauteur absente / ≤ 0
 *   - 'no_angle'      : angle absent / non fini
 *   - 'pointing_up'   : appareil pointé vers le haut (plongée ≤ 0)
 *   - 'angle_too_small': trop proche de l'horizon → distance diverge
 *   - 'clamped_max'   : distance calculée > maxDistanceM (bornée)
 *
 * @param {Object} i
 * @param {number} i.heightM       - hauteur de montage (m)
 * @param {number} i.depressionDeg - angle de plongée (°)
 * @returns {{distanceM: number|null, reason: string|null}}
 */
export function computeGroundDistance({ heightM = null, depressionDeg = null } = {}) {
  const h = heightM == null || heightM === '' ? NaN : Number(heightM);
  if (!Number.isFinite(h) || h <= 0) {
    return { distanceM: null, reason: 'invalid_height' };
  }

  const dep = depressionDeg == null || depressionDeg === '' ? NaN : Number(depressionDeg);
  if (!Number.isFinite(dep)) {
    return { distanceM: null, reason: 'no_angle' };
  }
  if (dep <= 0) {
    return { distanceM: null, reason: 'pointing_up' };
  }
  if (dep < MEASURE_LIMITS.minDepressionDeg) {
    return { distanceM: null, reason: 'angle_too_small' };
  }

  const rad = (dep * Math.PI) / 180;
  const raw = h / Math.tan(rad);

  if (!Number.isFinite(raw) || raw < 0) {
    return { distanceM: null, reason: 'angle_too_small' };
  }
  if (raw > MEASURE_LIMITS.maxDistanceM) {
    return { distanceM: MEASURE_LIMITS.maxDistanceM, reason: 'clamped_max' };
  }

  // L'input distance_m est entier (1..999) → on arrondit, plancher 1.
  const distanceM = Math.max(1, Math.round(raw));
  return { distanceM, reason: null };
}

/**
 * Combinaison orientation → distance, en un seul appel (utilisé par l'UI).
 *
 * @param {Object} i
 * @param {number} i.heightM
 * @param {number} [i.beta]
 * @param {number} [i.gamma]
 * @param {string|number} [i.orientation]
 * @returns {{distanceM: number|null, depressionDeg: number|null, reason: string|null}}
 */
export function measureFromPhone({ heightM = null, beta = null, gamma = null, orientation = 'portrait' } = {}) {
  const depressionDeg = depressionFromOrientation({ beta, gamma, orientation });
  const { distanceM, reason } = computeGroundDistance({ heightM, depressionDeg });
  return { distanceM, depressionDeg, reason };
}
