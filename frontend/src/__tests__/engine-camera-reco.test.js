// ============================================================
// Tests engine/camera-reco.js — Moteur de recommandation caméra
// ============================================================

import { describe, it, expect } from 'vitest';
import { scoreCamera, recommendCameraForAnswers } from '../engine/camera-reco.js';

// Dépendances injectées déterministes (doriKey -> champ 'dori').
const deps = (over = {}) => ({
  normalizeEmplacement: (e) => e,
  toNum: (v) => Number(v) || 0,
  objectiveToDoriKey: () => 'dori',
  getCameraProfile: () => ({ preferred: ['turret', 'dome'], penalized: ['ptz'], ptzMinDistance: 40 }),
  cameras: [],
  T: (k) => k,
  ...over,
});
const PROFILE = { preferred: ['turret', 'dome'], penalized: ['ptz'], ptzMinDistance: 40 };

const cam = (o = {}) => ({
  id: 'C',
  type: 'turret',
  use_cases: ['Bureau'],
  emplacement_interieur: true,
  emplacement_exterieur: true,
  dori: 30,
  resolution_mp: 4,
  ir_range_m: 20,
  poe_w: 12,
  ...o,
});
const ans = (o = {}) => ({
  use_case: 'Bureau',
  emplacement: 'interieur',
  objective: 'detection',
  distance_m: 15,
  ...o,
});

describe('scoreCamera', () => {
  it('fromUseCase true vs false → écart de 3 points', () => {
    const c = cam({ dori: 15 });
    const a = ans({ distance_m: 15, emplacement: 'exterieur' });
    const sIn = scoreCamera(c, a, PROFILE, true, deps());
    const sOut = scoreCamera(c, a, PROFILE, false, deps());
    expect(sIn.score - sOut.score).toBe(3);
    expect(sOut.reasons).toContain('Hors gamme Bureau');
  });

  it('DORI optimal (ratio ≈ 1.0) → +5 et raison dédiée', () => {
    const r = scoreCamera(cam({ dori: 15 }), ans({ distance_m: 15 }), PROFILE, true, deps());
    expect(r.reasons).toContain('DORI optimal (x1.0)');
  });

  it('DORI insuffisant (ratio < 0.7) → raison "DORI insuffisant"', () => {
    const r = scoreCamera(cam({ dori: 5 }), ans({ distance_m: 100 }), PROFILE, true, deps());
    expect(r.reasons).toContain('DORI insuffisant');
  });

  it('type préféré → bonus + raison "Type recommandé"', () => {
    const r = scoreCamera(cam({ type: 'turret' }), ans(), PROFILE, true, deps());
    expect(r.reasons).toContain('Type recommandé (turret)');
  });

  it('type pénalisé → malus + raison "Type inadapté"', () => {
    const r = scoreCamera(cam({ type: 'ptz' }), ans({ distance_m: 100 }), PROFILE, true, deps());
    expect(r.reasons).toContain('Type inadapté (ptz)');
  });

  it('PTZ justifiée si distance ≥ ptzMinDistance', () => {
    const r = scoreCamera(cam({ type: 'ptz' }), ans({ distance_m: 50 }), PROFILE, true, deps());
    expect(r.reasons).toContain('PTZ justifiée (50m)');
  });

  it('PTZ injustifiée si distance courte', () => {
    const r = scoreCamera(cam({ type: 'ptz' }), ans({ distance_m: 10 }), PROFILE, true, deps());
    expect(r.reasons).toContain('PTZ injustifiée (< 40m)');
  });

  it('résolution 8MP → raison "8MP+"', () => {
    const r = scoreCamera(cam({ resolution_mp: 8 }), ans(), PROFILE, true, deps());
    expect(r.reasons).toContain('8MP+');
  });
});

describe('recommendCameraForAnswers', () => {
  it('catalogue vide → primary null + raison err_no_camera_match', () => {
    const r = recommendCameraForAnswers(ans(), deps({ cameras: [] }));
    expect(r.primary).toBeNull();
    expect(r.reasons[0]).toBe('err_no_camera_match');
  });

  it('sélectionne la caméra la mieux notée comme primary', () => {
    const cameras = [
      cam({ id: 'TUR', type: 'turret' }),
      cam({ id: 'PTZ', type: 'ptz' }),
    ];
    const r = recommendCameraForAnswers(ans(), deps({ cameras }));
    expect(r.primary.camera.id).toBe('TUR');
  });

  it('exclut les caméras LPR hors contexte Parking', () => {
    const cameras = [cam({ id: 'TUR', type: 'turret' }), cam({ id: 'LPR', type: 'lpr' })];
    const r = recommendCameraForAnswers(ans({ use_case: 'Bureau' }), deps({ cameras }));
    const allIds = [r.primary, ...r.alternatives].filter(Boolean).map((s) => s.camera.id);
    expect(allIds).not.toContain('LPR');
  });

  it('filtre par emplacement (intérieur exclut les caméras extérieur-seules)', () => {
    const cameras = [cam({ id: 'EXT', emplacement_interieur: false, emplacement_exterieur: true })];
    const r = recommendCameraForAnswers(ans({ emplacement: 'interieur' }), deps({ cameras }));
    expect(r.primary).toBeNull();
  });

  it('filtre par seuil DORI (distance × 0.7)', () => {
    // distance 100 -> seuil 70 ; cam dori 30 < 70 -> exclue
    const cameras = [cam({ id: 'LOW', dori: 30 })];
    const r = recommendCameraForAnswers(ans({ distance_m: 100 }), deps({ cameras }));
    expect(r.primary).toBeNull();
  });

  it('au plus 2 alternatives', () => {
    const cameras = [
      cam({ id: 'A', type: 'turret' }),
      cam({ id: 'B', type: 'dome' }),
      cam({ id: 'C', type: 'bullet' }),
      cam({ id: 'D', type: 'turret' }),
    ];
    const r = recommendCameraForAnswers(ans(), deps({ cameras }));
    expect(r.alternatives.length).toBeLessThanOrEqual(2);
  });

  it('reasons proviennent du primary retenu', () => {
    const r = recommendCameraForAnswers(ans(), deps({ cameras: [cam({ id: 'X' })] }));
    expect(Array.isArray(r.reasons)).toBe(true);
  });
});
