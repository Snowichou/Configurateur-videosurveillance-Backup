// ============================================================
// Tests engine/totals.js — Débit / PoE / score critique
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  estimateCameraBitrateMbps,
  computeTotals,
  computeCriticalProjectScore,
} from '../engine/totals.js';

const REC = { fps: 15, codec: 'h265', mode: 'continuous' };

describe('estimateCameraBitrateMbps', () => {
  it('utilise bitrate_mbps_typical si présent (FPS 15 neutre)', () => {
    expect(estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, REC, 'standard')).toBe(10);
  });

  it('fallback resolution_mp × 1.2 si pas de bitrate typique', () => {
    expect(estimateCameraBitrateMbps({ resolution_mp: 4 }, REC, 'standard')).toBeCloseTo(4.8);
  });

  it('FPS multiplie proportionnellement (30 fps → ×2)', () => {
    expect(
      estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, { ...REC, fps: 30 }, 'standard'),
    ).toBe(20);
  });

  it('codec h264 → ×1.35', () => {
    expect(
      estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, { ...REC, codec: 'h264' }, 'standard'),
    ).toBeCloseTo(13.5);
  });

  it('mode motion → ×0.40', () => {
    expect(
      estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, { ...REC, mode: 'motion' }, 'standard'),
    ).toBeCloseTo(4);
  });

  it('qualité low → ×0.75, high → ×1.20', () => {
    expect(estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, REC, 'low')).toBeCloseTo(7.5);
    expect(estimateCameraBitrateMbps({ bitrate_mbps_typical: 10 }, REC, 'high')).toBeCloseTo(12);
  });

  it('plancher à 0,5 Mbps', () => {
    expect(estimateCameraBitrateMbps({ bitrate_mbps_typical: 0.1 }, REC, 'standard')).toBe(0.5);
  });
});

describe('computeTotals', () => {
  const cams = {
    A: { bitrate_mbps_typical: 10, poe_w: 15 },
    B: { bitrate_mbps_typical: 5, poe_w: 8 },
  };
  const deps = { getCameraById: (id) => cams[id] || null };

  it('agrège débit entrant et conso PoE', () => {
    const lines = [
      { cameraId: 'A', qty: 2, quality: 'standard' },
      { cameraId: 'B', qty: 1, quality: 'standard' },
    ];
    const r = computeTotals(lines, REC, deps);
    expect(r.totalInMbps).toBe(25); // 2×10 + 1×5
    expect(r.totalPoeW).toBe(38); // 2×15 + 1×8
  });

  it('ignore les lignes dont la caméra est introuvable', () => {
    const r = computeTotals([{ cameraId: 'ZZZ', qty: 3 }], REC, deps);
    expect(r).toEqual({ totalInMbps: 0, totalPoeW: 0 });
  });

  it('liste vide → totaux à zéro', () => {
    expect(computeTotals([], REC, deps)).toEqual({ totalInMbps: 0, totalPoeW: 0 });
  });

  it('cameraLines non-tableau → ne crash pas', () => {
    expect(computeTotals(null, REC, deps)).toEqual({ totalInMbps: 0, totalPoeW: 0 });
  });
});

describe('computeCriticalProjectScore', () => {
  it('retourne le pire score parmi les blocs validés', () => {
    const blocks = [
      { validated: true, selectedCameraScore: 80 },
      { validated: true, selectedCameraScore: 60 },
      { validated: false, selectedCameraScore: 10 },
    ];
    expect(computeCriticalProjectScore(blocks)).toBe(60);
  });

  it('aucun bloc validé → null', () => {
    expect(computeCriticalProjectScore([{ validated: false, selectedCameraScore: 50 }])).toBeNull();
  });

  it('ignore les scores non finis', () => {
    const blocks = [
      { validated: true, selectedCameraScore: 'abc' },
      { validated: true, selectedCameraScore: 75 },
    ];
    expect(computeCriticalProjectScore(blocks)).toBe(75);
  });

  it('liste vide ou nulle → null', () => {
    expect(computeCriticalProjectScore([])).toBeNull();
    expect(computeCriticalProjectScore(null)).toBeNull();
  });
});
