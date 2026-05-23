// ============================================================
// Tests engine/camera-score.js — Moteur de scoring caméra
// ============================================================

import { describe, it, expect } from 'vitest';
import { scoreCameraForBlock, interpretScoreForBlock } from '../engine/camera-score.js';

// Dépendances injectées déterministes : on teste la FORMULE de scoring,
// pas les helpers DORI/MP/IR (testés ailleurs).
const PROFILE = { preferred: ['turret', 'dome'], penalized: ['ptz', 'lpr'], ptzMinDistance: 40 };
const deps = (over = {}) => ({
  getDoriForObjective: (cam) => cam.dori ?? null,
  normalizeEmplacement: (e) => e,
  getMpFromCam: (cam) => cam.mp ?? null,
  getIrFromCam: (cam) => cam.ir ?? null,
  getCameraProfile: () => PROFILE,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  objectiveLabel: (o) => o,
  T: (k) => k,
  ...over,
});
const block = (answers) => ({ answers });

describe('scoreCameraForBlock', () => {
  it('caméra optimale → score 100', () => {
    const r = scoreCameraForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 13, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.score).toBe(100);
    expect(r.ratio).toBeCloseTo(1.3);
    expect(r.typeWarning).toBe('');
    expect(r.parts).toHaveLength(4);
  });

  it('sans distance → scoreDori fallback 18', () => {
    const r = scoreCameraForBlock(
      block({ objective: 'detection', emplacement: 'interieur' }),
      { type: 'dome', dori: 13, mp: 5, ir: 40 },
      deps(),
    );
    // 18 (DORI fallback) + 13 (mp5) + 13 (ir40) + 8 (interieur mp>=4 +3, preferred +5)
    expect(r.score).toBe(52);
    expect(r.ratio).toBeNull();
  });

  it('MP/IR absents → sous-scores planchers (7)', () => {
    const r = scoreCameraForBlock(
      block({ objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret' },
      deps(),
    );
    // 18 + 7 + 7 + 5 (preferred turret)
    expect(r.score).toBe(37);
  });

  it('ratio DORI ≥ 1.3 → bucket DORI plein (60)', () => {
    const r = scoreCameraForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 50, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.ratio).toBe(5);
    expect(r.score).toBe(100);
  });

  it('PTZ courte distance → malus + typeWarning "PTZ injustifiée"', () => {
    const r = scoreCameraForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'ptz', dori: 50, mp: 4, ir: 30 },
      deps(),
    );
    expect(r.typeWarning).toContain('PTZ injustifiée');
    expect(r.score).toBe(69); // 60+11+11-13
  });

  it('LPR hors parking → typeWarning dédié', () => {
    const r = scoreCameraForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur', use_case: 'Couloir' }),
      { type: 'lpr', dori: 50, mp: 4, ir: 30 },
      deps(),
    );
    expect(r.typeWarning).toBe('LPR inadaptée hors contexte parking');
  });
});

describe('interpretScoreForBlock', () => {
  it('score élevé → niveau ok / badge OK', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 13, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.level).toBe('ok');
    expect(r.badge).toBe('OK');
    expect(r.hardRule).toBe(false);
  });

  it('score faible → niveau bad / badge INADAPTÉ', () => {
    const r = interpretScoreForBlock(
      block({ objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret' },
      deps(),
    );
    expect(r.score).toBe(37);
    expect(r.level).toBe('bad');
    expect(r.badge).toBe('INADAPTÉ');
  });

  it('hard rule DORI : ratio < 0.80 (non-identification) → bad', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 100, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 50, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.ratio).toBe(0.5);
    expect(r.hardRule).toBe(true);
    expect(r.level).toBe('bad');
  });

  it('hard rule identification : ratio 0.82 < 0.85 → bad', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 100, objective: 'identification', emplacement: 'exterieur' }),
      { type: 'turret', dori: 82, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.ratio).toBeCloseTo(0.82);
    expect(r.hardRule).toBe(true);
    expect(r.level).toBe('bad');
  });

  it('même ratio 0.82 mais objectif detection → pas de hard rule', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 100, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 82, mp: 8, ir: 60 },
      deps(),
    );
    expect(r.hardRule).toBe(false);
    expect(r.level).toBe('ok');
  });

  it('typeWarning → score visible plafonné à 60', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'ptz', dori: 50, mp: 4, ir: 30 },
      deps(),
    );
    expect(r.typeWarning).toContain('PTZ injustifiée');
    expect(r.score).toBe(60); // brut 69 plafonné
    expect(r.level).toBe('warn');
  });

  it('expose keyPoint et message (chaînes non vides)', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori: 13, mp: 8, ir: 60 },
      deps(),
    );
    expect(typeof r.keyPoint).toBe('string');
    expect(r.keyPoint.length).toBeGreaterThan(0);
    expect(typeof r.message).toBe('string');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('deps absents → fallbacks, pas de crash', () => {
    const r = interpretScoreForBlock(
      block({ distance_m: 10, objective: 'detection', emplacement: 'exterieur' }),
      { type: 'turret', dori_detection_m: 13 },
    );
    expect(typeof r.score).toBe('number');
    expect(['ok', 'warn', 'bad']).toContain(r.level);
  });
});
