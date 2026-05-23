// ============================================================
// Tests engine — Scoring & DORI helpers (Phase 1)
// ============================================================
//
// Couvre src/engine/scoring.js : helpers purs DORI/MP/IR + levels.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  normalizeEmplacement,
  objectiveToDoriKey,
  getDoriForObjective,
  getMpFromCam,
  getIrFromCam,
  levelFromScore,
  levelFromScoreStrict,
} from '../engine/scoring.js';

// ─── normalizeEmplacement ───────────────────────────────────
describe('normalizeEmplacement', () => {
  it('"Extérieur" → "exterieur"', () => {
    expect(normalizeEmplacement('Extérieur')).toBe('exterieur');
  });

  it('"INT" → "interieur"', () => {
    expect(normalizeEmplacement('INT')).toBe('interieur');
  });

  it('"ext-jardin" → "exterieur" (préfixe)', () => {
    expect(normalizeEmplacement('ext-jardin')).toBe('exterieur');
  });

  it('null / undefined / "" → ""', () => {
    expect(normalizeEmplacement(null)).toBe('');
    expect(normalizeEmplacement(undefined)).toBe('');
    expect(normalizeEmplacement('')).toBe('');
  });

  it('valeur inconnue → renvoyée en minuscules', () => {
    expect(normalizeEmplacement('autre')).toBe('autre');
  });
});

// ─── objectiveToDoriKey ─────────────────────────────────────
describe('objectiveToDoriKey', () => {
  it('mappe les 4 objectifs standards', () => {
    expect(objectiveToDoriKey('detection')).toBe('dori_detection_m');
    expect(objectiveToDoriKey('observation')).toBe('dori_observation_m');
    expect(objectiveToDoriKey('reconnaissance')).toBe('dori_recognition_m');
    expect(objectiveToDoriKey('identification')).toBe('dori_identification_m');
  });

  it('défaut → identification', () => {
    expect(objectiveToDoriKey('inconnu')).toBe('dori_identification_m');
    expect(objectiveToDoriKey('')).toBe('dori_identification_m');
  });
});

// ─── getDoriForObjective ────────────────────────────────────
describe('getDoriForObjective', () => {
  const cam = {
    dori_detection_m: 100,
    dori_observation_m: 50,
    dori_recognition_m: 20,
    dori_identification_m: 10,
  };

  it('lit la bonne colonne par objectif', () => {
    expect(getDoriForObjective(cam, 'detection')).toBe(100);
    expect(getDoriForObjective(cam, 'identification')).toBe(10);
  });

  it('cam null → null', () => {
    expect(getDoriForObjective(null, 'identification')).toBeNull();
  });

  it('legacy "dissuasion" → observation', () => {
    expect(getDoriForObjective(cam, 'dissuasion')).toBe(50);
  });

  it('valeur 0 ou négative → null (DORI invalide)', () => {
    const c = { dori_detection_m: 0, dori_identification_m: -5 };
    expect(getDoriForObjective(c, 'detection')).toBeNull();
    expect(getDoriForObjective(c, 'identification')).toBeNull();
  });

  it('virgule décimale CSV → parse correctement', () => {
    const c = { dori_identification_m: '15,5' };
    expect(getDoriForObjective(c, 'identification')).toBe(15.5);
  });

  it('valeur non numérique → null', () => {
    const c = { dori_identification_m: 'N/A' };
    expect(getDoriForObjective(c, 'identification')).toBeNull();
  });
});

// ─── getMpFromCam ───────────────────────────────────────────
describe('getMpFromCam', () => {
  it('lit resolution_mp', () => {
    expect(getMpFromCam({ resolution_mp: 4 })).toBe(4);
    expect(getMpFromCam({ resolution_mp: 8 })).toBe(8);
  });

  it('virgule décimale CSV → parse', () => {
    expect(getMpFromCam({ resolution_mp: '2,5' })).toBe(2.5);
  });

  it('cam null / sans resolution_mp → 0 (Number("") === 0)', () => {
    // Note : "" → 0 (finite) — comportement préservé depuis le legacy app.js
    expect(getMpFromCam(null)).toBe(0);
    expect(getMpFromCam({})).toBe(0);
  });

  it('valeur explicitement non numérique → null', () => {
    expect(getMpFromCam({ resolution_mp: 'N/A' })).toBeNull();
  });
});

// ─── getIrFromCam ───────────────────────────────────────────
describe('getIrFromCam', () => {
  it('lit ir_range_m', () => {
    expect(getIrFromCam({ ir_range_m: 30 })).toBe(30);
  });

  it('virgule décimale CSV → parse', () => {
    expect(getIrFromCam({ ir_range_m: '12,5' })).toBe(12.5);
  });

  it('cam sans IR → 0 (Number("") === 0)', () => {
    // Comportement legacy : empty string → 0 finie
    expect(getIrFromCam({})).toBe(0);
    expect(getIrFromCam(null)).toBe(0);
  });

  it('valeur explicitement non numérique → null', () => {
    expect(getIrFromCam({ ir_range_m: '—' })).toBeNull();
  });
});

// ─── levelFromScore ─────────────────────────────────────────
describe('levelFromScore', () => {
  it('score >= 78 → OK 🟢', () => {
    expect(levelFromScore(80).level).toBe('OK');
    expect(levelFromScore(100).level).toBe('OK');
    expect(levelFromScore(78).level).toBe('OK');
  });

  it('60 <= score < 78 → LIM 🟡', () => {
    expect(levelFromScore(60).level).toBe('LIM');
    expect(levelFromScore(70).level).toBe('LIM');
    expect(levelFromScore(77).level).toBe('LIM');
  });

  it('score < 60 → BAD 🔴', () => {
    expect(levelFromScore(0).level).toBe('BAD');
    expect(levelFromScore(59).level).toBe('BAD');
  });

  it('score non numérique (NaN) → LIM par défaut', () => {
    expect(levelFromScore('abc').level).toBe('LIM');
    expect(levelFromScore(undefined).level).toBe('LIM');
    expect(levelFromScore(NaN).level).toBe('LIM');
    // Note : Number(null) === 0 (finite) → BAD, pas LIM
  });

  it('chaque niveau a un emoji', () => {
    expect(levelFromScore(80).dot).toBeTruthy();
    expect(levelFromScore(60).dot).toBeTruthy();
    expect(levelFromScore(0).dot).toBeTruthy();
  });
});

// ─── levelFromScoreStrict ───────────────────────────────────
describe('levelFromScoreStrict', () => {
  it('OK -> ok, LIM -> warn, BAD -> bad (CSS-friendly)', () => {
    expect(levelFromScoreStrict(80).level).toBe('ok');
    expect(levelFromScoreStrict(60).level).toBe('warn');
    expect(levelFromScoreStrict(40).level).toBe('bad');
  });

  it('conserve dot et label de la version brute', () => {
    const strict = levelFromScoreStrict(80);
    const base = levelFromScore(80);
    expect(strict.dot).toBe(base.dot);
    expect(strict.label).toBe(base.label);
  });
});
