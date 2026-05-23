// ============================================================
// engine/camera-reco.js — Moteur de recommandation caméra
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Logique métier pure.
//
// scoreCamera               : note interne d'une caméra candidate
//                             (DORI, résolution, IR, type, PoE...).
// recommendCameraForAnswers : sélectionne primary + alternatives à
//                             partir des réponses d'un bloc, via 2
//                             pools (use_case strict / emplacement
//                             large), scoring, diversité de types,
//                             garde-fous LPR / PTZ intérieur.
//
// 100% pur : catalogue caméras, profil métier et i18n injectés via
// `deps`. Le wrapper app.js injecte ses propres dépendances afin de
// garantir un comportement identique au legacy.
// ============================================================

import { toNum as defaultToNum } from '../utils/format.js';
import {
  normalizeEmplacement as defaultNormalizeEmplacement,
  objectiveToDoriKey as defaultObjectiveToDoriKey,
} from './scoring.js';

const identityT = (k) => String(k ?? '');
const DEFAULT_PROFILE = { preferred: [], penalized: [], ptzMinDistance: 40 };

/**
 * Note interne d'une caméra candidate pour un contexte donné.
 *
 * @param {Object}  c           - fiche caméra du catalogue
 * @param {Object}  ans         - réponses du bloc ({ use_case, emplacement, objective, distance_m })
 * @param {Object}  profile     - profil métier ({ preferred, penalized, ptzMinDistance })
 * @param {boolean} fromUseCase - true si la caméra provient du pool use_case strict
 * @param {Object}  [deps]
 * @returns {{camera:Object, score:number, reasons:string[], camType:string}}
 */
export function scoreCamera(c, ans, profile, fromUseCase, deps = {}) {
  const normalizeEmplacement = deps.normalizeEmplacement || defaultNormalizeEmplacement;
  const toNum = deps.toNum || defaultToNum;
  const objectiveToDoriKey = deps.objectiveToDoriKey || defaultObjectiveToDoriKey;
  const prof = profile || DEFAULT_PROFILE;

  const emplacement = normalizeEmplacement(ans.emplacement);
  const objective = String(ans.objective || '').trim();
  const distance = toNum(ans.distance_m) || 0;
  const useCase = String(ans.use_case || '').trim();
  const doriKey = objectiveToDoriKey(objective || 'identification');

  let score = 0;
  const reasons = [];
  const camType = String(c.type || '')
    .toLowerCase()
    .trim();
  const doriCam = c[doriKey] ?? 0;

  // Bonus/malus use_case match
  if (fromUseCase) {
    score += 2;
  } else {
    score -= 1;
    reasons.push('Hors gamme ' + useCase);
  }

  // 1) DORI vs distance — le "juste bien" est le meilleur
  if (distance > 0) {
    const ratio = doriCam / distance;
    if (ratio >= 0.95 && ratio <= 1.5) {
      score += 5;
      reasons.push('DORI optimal (x' + ratio.toFixed(1) + ')');
    } else if (ratio > 1.5 && ratio <= 2.5) {
      score += 4;
      reasons.push('Bonne marge DORI');
    } else if (ratio > 2.5 && ratio <= 5.0) {
      score += 2;
      reasons.push('Surdimensionné');
    } else if (ratio > 5.0) {
      score += 0;
    } else if (ratio >= 0.7) {
      score += 3;
      reasons.push('DORI limite (x' + ratio.toFixed(1) + ')');
    } else {
      score += 0;
      reasons.push('DORI insuffisant');
    }
    // Pénalité surdimensionnement
    if (ratio > 10.0) {
      score -= 3;
    } else if (ratio > 5.0) {
      score -= 2;
    } else if (ratio > 3.0) {
      score -= 1;
    }
  } else {
    score += 1;
  }

  // 2) Résolution
  const mp = c.resolution_mp ?? 0;
  if (mp >= 8) {
    score += 1.5;
    reasons.push('8MP+');
  } else if (mp >= 4) {
    score += 1;
  }

  // 3) IR
  const ir = c.ir_range_m ?? 0;
  if (emplacement === 'exterieur' && ir >= 30) {
    score += 1;
    reasons.push('Bon IR');
  } else if (ir >= 20) {
    score += 0.5;
  }

  // 4) Low light
  if (c.low_light) {
    score += 0.5;
  }

  // 5) Cohérence type / profil métier
  if (prof.preferred.includes(camType)) {
    score += 3;
    reasons.push('Type recommandé (' + camType + ')');
  } else if (prof.penalized.includes(camType)) {
    score -= 3;
    reasons.push('Type inadapté (' + camType + ')');
  }

  // 6) PTZ
  if (camType === 'ptz') {
    const minDist = prof.ptzMinDistance || 40;
    if (distance >= minDist) {
      score += 2;
      reasons.push('PTZ justifiée (' + distance + 'm)');
    } else if (distance <= 0) {
      score -= 2;
    } else {
      score -= 4;
      reasons.push('PTZ injustifiée (< ' + minDist + 'm)');
    }
  }

  // LPR hors parking
  if (camType === 'lpr' && useCase !== 'Parking') {
    score -= 4;
  }

  // 7) PoE
  const poe = c.poe_w ?? 0;
  if (poe > 30) {
    score -= 1;
  } else if (poe <= 8 && poe > 0) {
    score += 0.5;
    reasons.push('PoE économe');
  }

  // 8) Contextuels
  if ((c.ik ?? 0) >= 10) {
    if (useCase === 'Parking' || useCase === 'Logement collectif') {
      score += 2;
      reasons.push('IK10');
    } else if (emplacement === 'exterieur') {
      score += 1;
    }
  }
  if ((c.ip ?? 0) >= 67 && emplacement === 'exterieur') {
    score += 0.5;
  }
  if (c.microphone && emplacement === 'interieur') {
    score += 0.5;
  }

  // 9) Focale
  const f = c.focal_min_mm ?? 0;
  if (objective === 'dissuasion' && f > 0 && f <= 2.8) {
    score += 1;
    reasons.push('Grand angle');
  } else if (objective === 'identification' && f >= 4.0 && camType !== 'ptz') {
    score += 0.5;
  }

  return { camera: c, score, reasons, camType };
}

/**
 * Recommande une caméra (primary) + jusqu'à 2 alternatives.
 *
 * @param {Object} ans - réponses du bloc
 * @param {Object} [deps]
 * @param {Array}  [deps.cameras]          - catalogue caméras (CATALOG.CAMERAS)
 * @param {Function} [deps.getCameraProfile]
 * @param {Function} [deps.T]
 * @returns {{primary:Object|null, alternatives:Object[], reasons:string[]}}
 */
export function recommendCameraForAnswers(ans, deps = {}) {
  const normalizeEmplacement = deps.normalizeEmplacement || defaultNormalizeEmplacement;
  const toNum = deps.toNum || defaultToNum;
  const objectiveToDoriKey = deps.objectiveToDoriKey || defaultObjectiveToDoriKey;
  const getCameraProfile =
    typeof deps.getCameraProfile === 'function' ? deps.getCameraProfile : () => DEFAULT_PROFILE;
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const cameras = Array.isArray(deps.cameras) ? deps.cameras : [];

  const useCase = String(ans.use_case || '').trim();
  const emplacement = normalizeEmplacement(ans.emplacement);
  const objective = String(ans.objective || '').trim();
  const distance = toNum(ans.distance_m) || 0;
  const profile = getCameraProfile(useCase, emplacement);
  const doriKey = objectiveToDoriKey(objective || 'identification');
  const doriThreshold = distance > 0 ? distance * 0.7 : 0;

  // ── Pool 1 : use_case + emplacement + DORI ──
  let pool1 = [...cameras];
  if (useCase) pool1 = pool1.filter((c) => (c.use_cases || []).some((u) => u === useCase));
  if (emplacement === 'interieur') pool1 = pool1.filter((c) => c.emplacement_interieur === true);
  else if (emplacement === 'exterieur')
    pool1 = pool1.filter((c) => c.emplacement_exterieur === true);
  if (doriThreshold > 0) pool1 = pool1.filter((c) => (c[doriKey] ?? 0) >= doriThreshold);
  // Exclure LPR sauf parking (lecture de plaque = parking uniquement)
  if (useCase !== 'Parking') {
    pool1 = pool1.filter((c) => String(c.type || '').toLowerCase() !== 'lpr');
  }

  // ── Pool 2 : emplacement + DORI SEULEMENT (pas de filtre use_case) ──
  // Sert à trouver des alternatives longue portée (PTZ, big bullet)
  let pool2 = [...cameras];
  if (emplacement === 'interieur') pool2 = pool2.filter((c) => c.emplacement_interieur === true);
  else if (emplacement === 'exterieur')
    pool2 = pool2.filter((c) => c.emplacement_exterieur === true);
  // Exclure LPR sauf parking
  if (useCase !== 'Parking') {
    pool2 = pool2.filter((c) => String(c.type || '').toLowerCase() !== 'lpr');
  }
  if (doriThreshold > 0) pool2 = pool2.filter((c) => (c[doriKey] ?? 0) >= doriThreshold);
  // Exclure celles déjà dans pool1 pour éviter les doublons
  const pool1Ids = new Set(pool1.map((c) => c.id));
  const pool2Only = pool2.filter((c) => !pool1Ids.has(c.id));

  // Si aucune cam du tout
  if (!pool1.length && !pool2Only.length) {
    return {
      primary: null,
      alternatives: [],
      reasons: [
        T('err_no_camera_match'),
        'Suggestions : réduire la distance, passer en détection/dissuasion, ou envisager un emplacement extérieur avec PTZ.',
      ],
    };
  }

  // ── Scorer les deux pools ──
  const scored1 = pool1.map((c) => scoreCamera(c, ans, profile, true, deps));
  const scored2 = pool2Only.map((c) => scoreCamera(c, ans, profile, false, deps));

  // ── Fusionner et trier ──
  const allScored = [...scored1, ...scored2].sort((a, b) => b.score - a.score);

  // ── Sélection : primary + alternatives diversifiées ──
  const primary = allScored[0];
  if (!primary) {
    return { primary: null, alternatives: [], reasons: [T('err_no_camera_adapted')] };
  }

  const primaryType = primary.camType || '';
  const alternatives = [];

  // Priorité 1 : un type différent du primary (diversité)
  for (const s of allScored.slice(1)) {
    if (alternatives.length >= 2) break;
    if (s.camType !== primaryType && !alternatives.some((a) => a.camType === s.camType)) {
      alternatives.push(s);
    }
  }
  // Priorité 2 : compléter avec les meilleurs restants
  for (const s of allScored.slice(1)) {
    if (alternatives.length >= 2) break;
    if (!alternatives.includes(s)) alternatives.push(s);
  }

  // Garde-fou : si le primary est un type totalement inadapté, retourner vide
  const primaryIsLPR = primaryType === 'lpr' && useCase !== 'Parking';
  const primaryIsPTZIndoor =
    primaryType === 'ptz' &&
    emplacement === 'interieur' &&
    (!Number.isFinite(distance) || distance < (profile.ptzMinDistance || 40));

  if (primaryIsLPR || primaryIsPTZIndoor) {
    // Chercher une alternative valide
    const validAlt = alternatives.find((a) => {
      const t = a.camType || '';
      if (t === 'lpr' && useCase !== 'Parking') return false;
      if (t === 'ptz' && emplacement === 'interieur') return false;
      return true;
    });
    if (validAlt) {
      // Promouvoir l'alternative comme primary
      const newAlts = alternatives.filter((a) => a !== validAlt);
      return { primary: validAlt, alternatives: newAlts, reasons: validAlt.reasons || [] };
    }
    // Aucune alternative valide non plus
    return {
      primary: null,
      alternatives: [],
      reasons: [
        'Aucune caméra adaptée pour ' +
          (useCase || 'ce contexte') +
          ' ' +
          emplacement +
          ' à ' +
          distance +
          'm en ' +
          (objective || 'identification') +
          '.',
        'Suggestions : réduire la distance, passer en détection/dissuasion, ou envisager un emplacement extérieur.',
      ],
    };
  }

  return { primary, alternatives, reasons: primary.reasons || [] };
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  window._scoreCameraPure = scoreCamera;
  window._recommendCameraForAnswersPure = recommendCameraForAnswers;
}
