// ============================================================
// engine/camera-score.js — Moteur de scoring caméra
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Logique métier pure.
//
// scoreCameraForBlock   : note brute /100 (DORI, MP, IR, cohérence usage)
// interpretScoreForBlock: interprétation 3 niveaux (ok/warn/bad) + hard
//                         rules DORI + message commercial localisé.
//
// 100% pur : toutes les dépendances (helpers DORI/MP/IR, profil métier,
// i18n) sont injectées via `deps`. Des implémentations par défaut sont
// importées des modules engine/utils pour l'usage standalone et les
// tests ; le wrapper app.js injecte ses propres versions afin de
// garantir un comportement identique au legacy.
// ============================================================

import { clamp as defaultClamp } from '../utils/format.js';
import {
  normalizeEmplacement as defaultNormalizeEmplacement,
  getDoriForObjective as defaultGetDori,
  getMpFromCam as defaultGetMp,
  getIrFromCam as defaultGetIr,
} from './scoring.js';

const identityT = (k) => String(k ?? '');

/**
 * Score brut d'une caméra pour un bloc (contexte) donné.
 *
 * @param {Object} block - bloc caméra ({ answers: {...} })
 * @param {Object} cam   - fiche caméra du catalogue
 * @param {Object} [deps]
 * @returns {{score:number, parts:string[], ratio:number|null, dori:number|null,
 *            required:number, typeWarning:string, camType:string}}
 */
export function scoreCameraForBlock(block, cam, deps = {}) {
  const getDoriForObjective = deps.getDoriForObjective || defaultGetDori;
  const normalizeEmplacement = deps.normalizeEmplacement || defaultNormalizeEmplacement;
  const getMpFromCam = deps.getMpFromCam || defaultGetMp;
  const getIrFromCam = deps.getIrFromCam || defaultGetIr;
  const getCameraProfile =
    typeof deps.getCameraProfile === 'function' ? deps.getCameraProfile : null;
  const clamp = deps.clamp || defaultClamp;

  const ans = block?.answers || {};
  const required = Number(ans.distance_m || 0);
  const objective = ans.objective || '';
  const dori = getDoriForObjective(cam, objective);
  const empl = normalizeEmplacement(ans.emplacement);
  const useCase = String(ans.use_case || '').trim();
  const camType = String(cam.type || '')
    .toLowerCase()
    .trim();

  // 1) Distance vs DORI (60 pts)
  let ratio = null;
  let scoreDori = 0;
  if (required > 0 && Number.isFinite(required) && dori && dori > 0) {
    ratio = dori / required;
    const r = ratio;
    if (r >= 1.3) scoreDori = 60;
    else if (r >= 1.0) scoreDori = 52 + ((r - 1.0) * (60 - 52)) / 0.3;
    else if (r >= 0.8) scoreDori = 40 + ((r - 0.8) * (52 - 40)) / 0.2;
    else if (r >= 0.6) scoreDori = 25 + ((r - 0.6) * (40 - 25)) / 0.2;
    else if (r >= 0.4) scoreDori = 10 + ((r - 0.4) * (25 - 10)) / 0.2;
    else scoreDori = 6;
    scoreDori = clamp(Math.round(scoreDori), 0, 60);
  } else {
    scoreDori = 18;
  }

  // 2) MP (15 pts)
  const mp = getMpFromCam(cam);
  let scoreMp = 0;
  if (mp == null) scoreMp = 7;
  else if (mp >= 8) scoreMp = 15;
  else if (mp >= 5) scoreMp = 13;
  else if (mp >= 4) scoreMp = 11;
  else if (mp >= 2) scoreMp = 9;
  else scoreMp = 7;

  // 3) IR (15 pts)
  const ir = getIrFromCam(cam);
  let scoreIr = 0;
  if (ir == null) scoreIr = 7;
  else if (ir >= 60) scoreIr = 15;
  else if (ir >= 40) scoreIr = 13;
  else if (ir >= 30) scoreIr = 11;
  else if (ir >= 20) scoreIr = 9;
  else scoreIr = 7;

  // 4) Cohérence usage (10 pts) — enrichi avec le profil métier
  let bonus = 0;
  if (empl === 'exterieur' && ir != null && ir >= 30) bonus += 3;
  if (empl === 'interieur' && mp != null && mp >= 4) bonus += 3;
  if (ratio != null && ratio >= 1.15) bonus += 2;

  // Bonus/malus type caméra selon profil métier
  const profile = getCameraProfile ? getCameraProfile(useCase, empl) : null;
  if (profile) {
    if (profile.preferred.includes(camType)) bonus += 5;
    else if (profile.penalized.includes(camType)) bonus -= 8;
  }

  // Pénalité PTZ si distance trop courte
  if (camType === 'ptz' && profile) {
    const minDist = profile.ptzMinDistance || 40;
    if (!Number.isFinite(required) || required < minDist) bonus -= 10;
  }

  // Pénalité LPR hors parking
  if (camType === 'lpr' && useCase && useCase !== 'Parking') bonus -= 10;

  bonus = clamp(bonus, -15, 10);
  const score = clamp(scoreDori + scoreMp + scoreIr + bonus, 0, 100);

  // Déterminer le type de préoccupation principale
  let typeWarning = '';
  if (profile && profile.penalized.includes(camType)) {
    typeWarning = camType.toUpperCase() + ' inadaptée pour ' + (useCase || 'ce contexte') + ' ' + empl;
  }
  if (
    camType === 'ptz' &&
    profile &&
    (!Number.isFinite(required) || required < (profile.ptzMinDistance || 40))
  ) {
    typeWarning = 'PTZ injustifiée (distance < ' + (profile.ptzMinDistance || 40) + 'm)';
  }
  if (camType === 'lpr' && useCase && useCase !== 'Parking') {
    typeWarning = 'LPR inadaptée hors contexte parking';
  }

  const parts = [
    `DORI vs distance : ${scoreDori}/60${ratio != null ? ` (x${ratio.toFixed(2)})` : ''}`,
    `Qualité capteur : ${scoreMp}/15${mp != null ? ` (${mp}MP)` : ''}`,
    `IR / nuit : ${scoreIr}/15${ir != null ? ` (${ir}m)` : ''}`,
    `Cohérence usage : ${clamp(bonus, 0, 10)}/10${typeWarning ? ' ⚠️' : ''}`,
  ];

  return { score, parts, ratio, dori, required, typeWarning, camType };
}

/**
 * Interprétation "métier" du score (3 niveaux) + hard rules DORI.
 * - OK >= 75 / LIMITE 55..74 / INADAPTÉ < 55
 * - Hard rule marge DORI : Identification ratio < 0.85 => INADAPTÉ ;
 *   autres objectifs ratio < 0.80 => INADAPTÉ.
 *
 * @param {Object} block
 * @param {Object} cam
 * @param {Object} [deps]
 * @returns {Object} { ...score, score, level, badge, message, hardRule, keyPoint, typeWarning }
 */
export function interpretScoreForBlock(block, cam, deps = {}) {
  const normalizeEmplacement = deps.normalizeEmplacement || defaultNormalizeEmplacement;
  const getMpFromCam = deps.getMpFromCam || defaultGetMp;
  const getIrFromCam = deps.getIrFromCam || defaultGetIr;
  const objectiveLabel =
    typeof deps.objectiveLabel === 'function' ? deps.objectiveLabel : (o) => String(o ?? '');
  const T = typeof deps.T === 'function' ? deps.T : identityT;

  const sc = scoreCameraForBlock(block, cam, deps);
  const ans = block?.answers || {};
  const obj = String(ans.objective || '').toLowerCase();
  const empl = normalizeEmplacement(ans.emplacement);

  let level = 'ok';
  let badge = 'OK';
  let message = '—';

  if (sc.score >= 75) {
    level = 'ok';
    badge = 'OK';
  } else if (sc.score >= 55) {
    level = 'warn';
    badge = 'LIMITE';
  } else {
    level = 'bad';
    badge = 'INADAPTÉ';
  }

  // Hard rule DORI
  let hardRule = false;
  let minRatio = null;
  if (sc.ratio != null && Number.isFinite(sc.ratio)) {
    minRatio = obj === 'identification' ? 0.85 : 0.8;
    if (sc.ratio < minRatio) {
      level = 'bad';
      badge = 'INADAPTÉ';
      hardRule = true;
    }
  }

  // Hard rule TYPE — caméra inadaptée au contexte
  if (sc.typeWarning) {
    if (level !== 'bad') {
      level = 'warn';
      badge = 'LIMITE';
    }
  }

  const ansObj = String(ans.objective || '').toLowerCase();
  const objectiveLbl = (() => {
    try {
      return objectiveLabel(ansObj) || T('cam_objective');
    } catch {
      return T('cam_objective');
    }
  })();
  const emplLbl = empl === 'exterieur' ? 'extérieur' : 'intérieur';
  const dist = Number(sc.required || 0);
  const mp = getMpFromCam(cam);
  const ir = getIrFromCam(cam);
  const ratioTxt =
    sc.ratio != null && Number.isFinite(sc.ratio) ? `DORI x${sc.ratio.toFixed(2)}` : null;

  // Point critique
  let keyPoint = 'Point critique : —';
  try {
    if (sc.typeWarning) {
      keyPoint = `Point critique : ${sc.typeWarning}`;
    } else if (hardRule && minRatio != null && sc.ratio != null) {
      keyPoint = `Point critique : marge DORI insuffisante (x${sc.ratio.toFixed(2)} < x${minRatio.toFixed(2)})`;
    } else if (ratioTxt && sc.ratio < 1.0) {
      keyPoint = `Point critique : marge DORI faible (${ratioTxt})`;
    } else if (ir != null && ir < 30 && emplLbl === 'extérieur') {
      keyPoint = `Point critique : IR limite (${ir}m)`;
    } else if (mp != null && mp < 4) {
      keyPoint = `Point critique : niveau de détail (${mp}MP)`;
    } else {
      keyPoint = `Point critique : aucun — bonne adéquation`;
    }
  } catch {
    keyPoint = 'Point critique : —';
  }

  // Message simplifié pour les commerciaux — nuancé selon le score
  try {
    const score = sc.score;
    const objLow = objectiveLbl.toLowerCase();
    const emLow = emplLbl;

    if (sc.typeWarning) {
      // Type inadapté (ex: PTZ pour courte distance)
      const cleanWarn = sc.typeWarning.replace(/PTZ injustifiée.*/, T('cam_ptz_oversized'));
      message = cleanWarn;
    } else if (score >= 90) {
      message = `Choix optimal pour ${objLow} à ${dist}m en ${emLow}.`;
    } else if (score >= 80) {
      message = `${T('cam_good_choice').replace('{0}', objLow).replace('{1}', dist)}`;
    } else if (score >= 70) {
      message = `${T('cam_good_option_msg').replace('{0}', dist)}`;
    } else if (score >= 60) {
      message = `Utilisable mais portée DORI un peu juste pour ${dist}m.`;
    } else if (score >= 50) {
      message = `${T('cam_limit_msg').replace('{0}', dist)}`;
    } else {
      message = `${T('cam_insufficient_msg').replace('{0}', objLow).replace('{1}', dist)}`;
    }
  } catch {
    message = message || '—';
  }

  // Ajuster le score visible si le type est inadapté
  let adjustedScore = sc.score;
  if (sc.typeWarning && adjustedScore > 60) adjustedScore = Math.min(adjustedScore, 60);
  return {
    ...sc,
    score: adjustedScore,
    level,
    badge,
    message,
    hardRule,
    keyPoint,
    typeWarning: sc.typeWarning || '',
  };
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  window._scoreCameraForBlockPure = scoreCameraForBlock;
  window._interpretScoreForBlockPure = interpretScoreForBlock;
}
