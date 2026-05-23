// ============================================================
// Tests state/model.js — Factory MODEL initial
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInitialModel } from '../state/model.js';

describe('createInitialModel', () => {
  it('retourne un objet avec toutes les sections attendues', () => {
    const m = createInitialModel();
    expect(m).toMatchObject({
      cameraBlocks: [],
      cameraLines: [],
      accessoryLines: [],
      recording: expect.any(Object),
      complements: expect.any(Object),
      ui: expect.any(Object),
      projectName: '',
      projectUseCase: '',
      projectNotes: '',
      projectTags: '',
      stepIndex: 0,
    });
  });

  it('recording utilise les defaults sans limits', () => {
    const m = createInitialModel();
    expect(m.recording.daysRetention).toBe(14);
    expect(m.recording.hoursPerDay).toBe(24);
    expect(m.recording.fps).toBe(25);
    expect(m.recording.codec).toBe('h265');
    expect(m.recording.mode).toBe('continuous');
    expect(m.recording.overheadPct).toBe(20);
    expect(m.recording.reservePortsPct).toBe(10);
  });

  it('respecte un objet limits explicite', () => {
    const limits = {
      defaultRetentionDays: 7,
      maxHoursPerDay: 12,
      defaultFps: 15,
      defaultOverheadPct: 25,
      defaultReservePortsPct: 15,
    };
    const m = createInitialModel(limits);
    expect(m.recording.daysRetention).toBe(7);
    expect(m.recording.hoursPerDay).toBe(12);
    expect(m.recording.fps).toBe(15);
    expect(m.recording.overheadPct).toBe(25);
    expect(m.recording.reservePortsPct).toBe(15);
  });

  it('limits partiel → fallback sur les valeurs par défaut manquantes', () => {
    const m = createInitialModel({ defaultRetentionDays: 30 });
    expect(m.recording.daysRetention).toBe(30);
    expect(m.recording.fps).toBe(25); // fallback
  });

  it('null/undefined limits → utilise les fallbacks', () => {
    expect(createInitialModel(null).recording.fps).toBe(25);
    expect(createInitialModel(undefined).recording.fps).toBe(25);
  });

  it('complements ont les bonnes valeurs initiales', () => {
    const m = createInitialModel();
    expect(m.complements.screen).toEqual({ enabled: false, sizeInch: 18, qty: 1 });
    expect(m.complements.enclosure).toEqual({ enabled: false, qty: 1 });
    expect(m.complements.signage).toEqual({ enabled: false, scope: 'Public', qty: 1 });
  });

  it('ui.mode est "simple" par défaut', () => {
    const m = createInitialModel();
    expect(m.ui.mode).toBe('simple');
    expect(m.ui.demo).toBe(false);
    expect(m.ui.favorites).toEqual([]);
    expect(m.ui.compare).toEqual([]);
  });

  it('chaque appel retourne une nouvelle instance (pas un singleton)', () => {
    const m1 = createInitialModel();
    const m2 = createInitialModel();
    m1.cameraBlocks.push('test');
    expect(m2.cameraBlocks).toEqual([]); // pas affecté par la mutation de m1
  });

  it('les sous-objets sont aussi indépendants entre instances', () => {
    const m1 = createInitialModel();
    const m2 = createInitialModel();
    m1.recording.fps = 99;
    expect(m2.recording.fps).toBe(25);
    m1.ui.favorites.push('cam1');
    expect(m2.ui.favorites).toEqual([]);
  });
});
