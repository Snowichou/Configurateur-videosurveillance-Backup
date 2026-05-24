// engine/project.test.js -- Tests Vitest pour engine/project.js
import { describe, it, expect, vi } from 'vitest';
import { computeProjectPure } from '../engine/project.js';

// -- Deps minimales --
const makeDeps = (overrides = {}) => ({
  MODEL: {
    projectName: 'Test Projet',
    cameraLines: [],
    cameraBlocks: [],
    recording: {
      fps: 12,
      codec: 'H.265',
      mode: 'continuous',
      hoursPerDay: 24,
      daysRetention: 14,
      overheadPct: 15,
    },
    overrideNvrId: null,
  },
  CATALOG: {
    CAMERAS: [],
    NVRS: [],
    HDDS: [],
    SWITCHES: [],
    ACCESSORIES: [],
  },
  T: (key) => '[' + key + ']',
  KPI: null,
  clampNum: (v, min, max, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
  },
  computeTotals: () => ({ totalInMbps: 0, totalPoeW: 0 }),
  getCameraById: () => null,
  getTotalCameras: () => 0,
  mbpsToTB: () => 0,
  pickDisks: () => ({ disks: [], count: 0 }),
  pickNvr: () => ({ nvr: null, reason: '', alternatives: [] }),
  planPoESwitches: () => ({ required: false, switches: [] }),
  ...overrides,
});

describe('computeProjectPure -- structure de retour', () => {
  it('retourne un objet non null', () => {
    const proj = computeProjectPure(makeDeps());
    expect(proj).toBeDefined();
    expect(typeof proj).toBe('object');
  });

  it('contient les proprietes obligatoires', () => {
    const proj = computeProjectPure(makeDeps());
    expect(proj).toHaveProperty('totalCameras');
    expect(proj).toHaveProperty('totalInMbps');
    expect(proj).toHaveProperty('requiredTB');
    expect(proj).toHaveProperty('alerts');
    expect(proj).toHaveProperty('storageParams');
    expect(proj).toHaveProperty('nvrPick');
    expect(proj).toHaveProperty('switches');
  });

  it('alerts est un tableau', () => {
    const proj = computeProjectPure(makeDeps());
    expect(Array.isArray(proj.alerts)).toBe(true);
  });

  it('storageParams contient les champs attendus', () => {
    const proj = computeProjectPure(makeDeps());
    expect(proj.storageParams).toHaveProperty('daysRetention');
    expect(proj.storageParams).toHaveProperty('hoursPerDay');
    expect(proj.storageParams).toHaveProperty('codec');
    expect(proj.storageParams).toHaveProperty('ips');
    expect(proj.storageParams).toHaveProperty('mode');
  });
});

describe('computeProjectPure -- projectName', () => {
  it('prend projectName depuis MODEL', () => {
    const proj = computeProjectPure(makeDeps({
      MODEL: { ...makeDeps().MODEL, projectName: 'Site Beta' },
    }));
    expect(proj.projectName).toBe('Site Beta');
  });

  it('gere un projectName vide', () => {
    const proj = computeProjectPure(makeDeps({
      MODEL: { ...makeDeps().MODEL, projectName: '' },
    }));
    expect(proj.projectName).toBe('');
  });
});

describe('computeProjectPure -- appels aux deps', () => {
  it('appelle getTotalCameras()', () => {
    const getTotalCameras = vi.fn(() => 5);
    computeProjectPure(makeDeps({ getTotalCameras }));
    expect(getTotalCameras).toHaveBeenCalled();
  });

  it('appelle computeTotals()', () => {
    const computeTotals = vi.fn(() => ({ totalInMbps: 10, totalPoeW: 30 }));
    const proj = computeProjectPure(makeDeps({ computeTotals }));
    expect(computeTotals).toHaveBeenCalled();
    expect(proj.totalInMbps).toBeGreaterThanOrEqual(0);
  });

  it('appelle pickNvr() et inclut le resultat', () => {
    const fakeNvr = { nvr: { id: 'NVR-8', name: 'NVR 8 voies', max_in_mbps: 100 }, channels: 8, reason: '', alternatives: [] };
    const pickNvr = vi.fn(() => fakeNvr);
    const proj = computeProjectPure(makeDeps({ pickNvr }));
    expect(pickNvr).toHaveBeenCalled();
    expect(proj.nvrPick).toEqual(fakeNvr);
  });

  it('appelle planPoESwitches() et inclut le resultat', () => {
    const planPoESwitches = vi.fn(() => ({ required: true, switches: [{ id: 'SW-8' }] }));
    const proj = computeProjectPure(makeDeps({ planPoESwitches }));
    expect(planPoESwitches).toHaveBeenCalled();
    expect(proj.switches).toBeDefined();
  });

  it('appelle mbpsToTB() pour le calcul de stockage', () => {
    const mbpsToTB = vi.fn(() => 3.5);
    const computeTotals = vi.fn(() => ({ totalInMbps: 20, totalPoeW: 0 }));
    computeProjectPure(makeDeps({ mbpsToTB, computeTotals }));
    expect(mbpsToTB).toHaveBeenCalled();
  });
});

describe('computeProjectPure -- totalCameras', () => {
  it('reflete la valeur de getTotalCameras()', () => {
    const proj = computeProjectPure(makeDeps({ getTotalCameras: () => 8 }));
    expect(proj.totalCameras).toBe(8);
  });

  it('0 cameras par defaut', () => {
    const proj = computeProjectPure(makeDeps());
    expect(proj.totalCameras).toBe(0);
  });
});

describe('computeProjectPure -- robustesse', () => {
  it('ne plante pas si KPI est null', () => {
    expect(() => computeProjectPure(makeDeps({ KPI: null }))).not.toThrow();
  });

  it('ne plante pas si pickNvr retourne null', () => {
    expect(() => computeProjectPure(makeDeps({ pickNvr: () => ({ nvr: null, reason: 'aucun', alternatives: [] }) }))).not.toThrow();
  });

  it('ne plante pas si computeTotals retourne des valeurs nulles', () => {
    expect(() => computeProjectPure(makeDeps({
      computeTotals: () => ({ totalInMbps: null, totalPoeW: null }),
    }))).not.toThrow();
  });
});
