// ============================================================
// Tests engine — Mesure DORI par photo + gyroscope
// ============================================================
//
// Couvre src/engine/measure-distance.js :
//   - depressionFromOrientation (portrait / paysage / données absentes)
//   - computeGroundDistance (trigo + cas limites)
//   - measureFromPhone (combinaison)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  MEASURE_LIMITS,
  depressionFromOrientation,
  computeGroundDistance,
  measureFromPhone,
} from '../engine/measure-distance.js';

// ─── depressionFromOrientation ──────────────────────────────
describe('depressionFromOrientation', () => {
  it('portrait : beta=90 (vertical, vise l’horizon) → 0°', () => {
    expect(depressionFromOrientation({ beta: 90, orientation: 'portrait' })).toBe(0);
  });

  it('portrait : beta=45 → 45° de plongée', () => {
    expect(depressionFromOrientation({ beta: 45, orientation: 'portrait' })).toBe(45);
  });

  it('portrait : beta=0 (à plat, vers le sol) → 90°', () => {
    expect(depressionFromOrientation({ beta: 0, orientation: 'portrait' })).toBe(90);
  });

  it('paysage (chaîne) : gamma=-45 → 45°', () => {
    expect(
      depressionFromOrientation({ gamma: -45, orientation: 'landscape-primary' })
    ).toBe(45);
  });

  it('paysage (angle numérique 90) : gamma=30 → 60°', () => {
    expect(depressionFromOrientation({ gamma: 30, orientation: 90 })).toBe(60);
  });

  it('portrait sans beta → null', () => {
    expect(depressionFromOrientation({ orientation: 'portrait' })).toBeNull();
  });

  it('paysage sans gamma → null', () => {
    expect(depressionFromOrientation({ orientation: 'landscape' })).toBeNull();
  });
});

// ─── computeGroundDistance ──────────────────────────────────
describe('computeGroundDistance', () => {
  it('hauteur 3m, plongée 45° → 3m (tan45=1)', () => {
    const r = computeGroundDistance({ heightM: 3, depressionDeg: 45 });
    expect(r.reason).toBeNull();
    expect(r.distanceM).toBe(3);
  });

  it('hauteur 3m, plongée 30° → ≈5m', () => {
    const r = computeGroundDistance({ heightM: 3, depressionDeg: 30 });
    expect(r.reason).toBeNull();
    expect(r.distanceM).toBe(5); // 3/tan30 = 5.196 → 5
  });

  it('hauteur ≤ 0 → invalid_height', () => {
    expect(computeGroundDistance({ heightM: 0, depressionDeg: 45 }).reason).toBe('invalid_height');
    expect(computeGroundDistance({ heightM: -2, depressionDeg: 45 }).reason).toBe('invalid_height');
    expect(computeGroundDistance({ depressionDeg: 45 }).reason).toBe('invalid_height');
  });

  it('angle absent → no_angle', () => {
    expect(computeGroundDistance({ heightM: 3 }).reason).toBe('no_angle');
  });

  it('plongée ≤ 0 (vers le haut) → pointing_up', () => {
    expect(computeGroundDistance({ heightM: 3, depressionDeg: 0 }).reason).toBe('pointing_up');
    expect(computeGroundDistance({ heightM: 3, depressionDeg: -10 }).reason).toBe('pointing_up');
  });

  it('plongée trop faible (< 1°) → angle_too_small (divergence)', () => {
    const r = computeGroundDistance({ heightM: 3, depressionDeg: 0.5 });
    expect(r.distanceM).toBeNull();
    expect(r.reason).toBe('angle_too_small');
  });

  it('distance trop grande → bornée à maxDistanceM (clamped_max)', () => {
    const r = computeGroundDistance({ heightM: 50, depressionDeg: 1 });
    expect(r.distanceM).toBe(MEASURE_LIMITS.maxDistanceM);
    expect(r.reason).toBe('clamped_max');
  });

  it('plongée quasi verticale (90°) → plancher 1m', () => {
    const r = computeGroundDistance({ heightM: 3, depressionDeg: 90 });
    expect(r.reason).toBeNull();
    expect(r.distanceM).toBe(1);
  });
});

// ─── measureFromPhone ───────────────────────────────────────
describe('measureFromPhone', () => {
  it('hauteur 3m, beta 45° portrait → distance 3m', () => {
    const r = measureFromPhone({ heightM: 3, beta: 45, orientation: 'portrait' });
    expect(r.depressionDeg).toBe(45);
    expect(r.distanceM).toBe(3);
    expect(r.reason).toBeNull();
  });

  it('vise l’horizon (beta 90) → pointing_up, pas de distance', () => {
    const r = measureFromPhone({ heightM: 2.5, beta: 90, orientation: 'portrait' });
    expect(r.distanceM).toBeNull();
    expect(r.reason).toBe('pointing_up');
  });

  it('paysage : hauteur 4m, gamma -45 → distance 4m', () => {
    const r = measureFromPhone({ heightM: 4, gamma: -45, orientation: 'landscape-primary' });
    expect(r.depressionDeg).toBe(45);
    expect(r.distanceM).toBe(4);
  });
});
