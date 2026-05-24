// ============================================================
// Tests engine — NVR + Switches PoE
// ============================================================
//
// pickNvr : algo « gamme dominante » (décision Seb) — la gamme
// retenue est celle la plus représentée parmi les caméras
// configurées (lignes caméra), pondérée à +100 dans le score.
// ============================================================

import { describe, it, expect } from 'vitest';
import { planPoESwitches } from '../engine/poe.js';
import { pickNvr } from '../engine/pick-nvr.js';

// ─── Fixtures ────────────────────────────────────────────────
const CATALOG_NVRS = [
  { id: 'NEXT-4', brand_range: 'NEXT', channels: 4, max_in_mbps: 40, hdd_bays: 1, poe_ports: 4 },
  { id: 'NEXT-8', brand_range: 'NEXT', channels: 8, max_in_mbps: 80, hdd_bays: 1, poe_ports: 8 },
  { id: 'NEXT-16', brand_range: 'NEXT', channels: 16, max_in_mbps: 160, hdd_bays: 1, poe_ports: 16 },
  { id: 'ADV-4', brand_range: 'ADVANCE', channels: 4, max_in_mbps: 60, hdd_bays: 1, poe_ports: 4 },
  { id: 'ADV-8', brand_range: 'ADVANCE', channels: 8, max_in_mbps: 120, hdd_bays: 1, poe_ports: 8 },
  { id: 'ADV-16', brand_range: 'ADVANCE', channels: 16, max_in_mbps: 240, hdd_bays: 2, poe_ports: 16 },
  { id: 'ADV-32', brand_range: 'ADVANCE', channels: 32, max_in_mbps: 320, hdd_bays: 8, poe_ports: 0 },
  { id: 'ADV-64', brand_range: 'ADVANCE', channels: 64, max_in_mbps: 384, hdd_bays: 16, poe_ports: 0 },
  { id: 'ADV-128', brand_range: 'ADVANCE', channels: 128, max_in_mbps: 512, hdd_bays: 16, poe_ports: 0 },
];

const CATALOG_HDDS = [
  { id: 'HDD-1', capacity_tb: 1 },
  { id: 'HDD-2', capacity_tb: 2 },
  { id: 'HDD-4', capacity_tb: 4 },
  { id: 'HDD-8', capacity_tb: 8 },
];

const CATALOG_SWITCHES = [
  { id: 'SW-4', poe_ports: 4, poe_budget_w: 60 },
  { id: 'SW-8', poe_ports: 8, poe_budget_w: 120 },
  { id: 'SW-16', poe_ports: 16, poe_budget_w: 240 },
  { id: 'SW-24', poe_ports: 24, poe_budget_w: 360 },
];

const CAM_DB = {
  CN: { id: 'CN', brand_range: 'NEXT' },
  CA: { id: 'CA', brand_range: 'ADVANCE' },
};
const deps = (cameraLines, over = {}) => ({
  cameraLines,
  getCameraById: (id) => CAM_DB[id] || null,
  catalogNvrs: CATALOG_NVRS,
  catalogHdds: CATALOG_HDDS,
  T: (k) => k,
  ...over,
});

// ─── Tests pickNvr ──────────────────────────────────────────
describe('pickNvr — sélection NVR (algo gamme dominante)', () => {
  it('caméras NEXT → NVR NEXT le plus petit couvrant les canaux', () => {
    const r = pickNvr(4, 30, 1, deps([{ cameraId: 'CN', qty: 4 }]));
    expect(r.nvr.id).toBe('NEXT-4');
    expect(r.reason).toContain('Gamme NEXT');
  });

  it('caméras ADVANCE → NVR ADVANCE', () => {
    const r = pickNvr(4, 30, 1, deps([{ cameraId: 'CA', qty: 4 }]));
    expect(r.nvr.id).toBe('ADV-4');
    expect(r.reason).toContain('Gamme ADVANCE');
  });

  it('gamme dominante = la plus représentée (5 ADVANCE vs 3 NEXT)', () => {
    const r = pickNvr(8, 60, 1, deps([
      { cameraId: 'CN', qty: 3 },
      { cameraId: 'CA', qty: 5 },
    ]));
    expect(r.nvr.brand_range).toBe('ADVANCE');
  });

  it('stockage important → privilégie un NVR avec assez de baies', () => {
    // 30 To / 8 To = 4 baies minimum
    const r = pickNvr(16, 200, 30, deps([{ cameraId: 'CA', qty: 16 }]));
    expect(r.nvr.hdd_bays).toBeGreaterThanOrEqual(4);
  });

  it('500 caméras → aucun NVR ne couvre → null', () => {
    const r = pickNvr(500, 100, 1, deps([{ cameraId: 'CA', qty: 500 }]));
    expect(r.nvr).toBeNull();
    expect(r.alternatives).toEqual([]);
  });

  it('alternatives : jusqu’à 3, sans le NVR retenu', () => {
    const r = pickNvr(4, 30, 1, deps([{ cameraId: 'CA', qty: 4 }]));
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives.length).toBeLessThanOrEqual(3);
    expect(r.alternatives.some((a) => a.id === r.nvr.id)).toBe(false);
  });

  it('aucune ligne caméra → gamme NEXT par défaut', () => {
    const r = pickNvr(4, 30, 1, deps([]));
    expect(r.nvr.brand_range).toBe('NEXT');
  });

  it('débit insuffisant → raison "débit à vérifier"', () => {
    // 16 cams NEXT, 9999 Mbps : aucun NVR ne couvre le débit
    const r = pickNvr(16, 9999, 1, deps([{ cameraId: 'CN', qty: 16 }]));
    expect(r.reason).toContain('débit à vérifier');
  });

  it('catalogue NVR vide → null', () => {
    const r = pickNvr(4, 30, 1, deps([{ cameraId: 'CN', qty: 4 }], { catalogNvrs: [] }));
    expect(r.nvr).toBeNull();
  });
});

// ─── Tests planPoESwitches ──────────────────────────────────
describe('planPoESwitches — dimensionnement switches PoE', () => {
  it('NVR avec poe_ports >= totalCams → aucun switch externe', () => {
    const nvr = { id: 'NEXT-16', poe_ports: 16 };
    const r = planPoESwitches(8, 10, nvr, CATALOG_SWITCHES);
    expect(r.required).toBe(false);
    expect(r.plan).toEqual([]);
    expect(r.camerasOnNvr).toBe(8);
  });

  it('NVR sans poe_ports → toutes les cams via switch', () => {
    const nvr = { id: 'ADV-32', poe_ports: 0 };
    const r = planPoESwitches(20, 10, nvr, CATALOG_SWITCHES);
    expect(r.required).toBe(true);
    expect(r.plan.length).toBeGreaterThan(0);
    expect(r.totalPorts).toBeGreaterThanOrEqual(22); // 20 + 10% reserve = 22
  });

  it('NVR partiellement couvrant → switch pour la différence', () => {
    const nvr = { id: 'ADV-16', poe_ports: 16 };
    const r = planPoESwitches(24, 0, nvr, CATALOG_SWITCHES);
    expect(r.required).toBe(true);
    expect(r.portsNeeded).toBe(8);
    expect(r.totalPorts).toBeGreaterThanOrEqual(8);
  });

  it("greedy : préfère les grands switches d'abord", () => {
    const nvr = { id: 'ADV-32', poe_ports: 0 };
    const r = planPoESwitches(40, 0, nvr, CATALOG_SWITCHES);
    expect(r.plan[0].item.poe_ports).toBe(24);
  });

  it('réserve PoE configurable (10% par défaut)', () => {
    const nvr = { id: 'ADV-32', poe_ports: 0 };
    const r0 = planPoESwitches(20, 0, nvr, CATALOG_SWITCHES);
    const r20 = planPoESwitches(20, 20, nvr, CATALOG_SWITCHES);
    expect(r20.portsNeeded).toBeGreaterThan(r0.portsNeeded);
  });

  it('catalogue switches vide → fallback générique', () => {
    const nvr = { id: 'ADV-32', poe_ports: 0 };
    const r = planPoESwitches(10, 10, nvr, []);
    expect(r.plan.length).toBeGreaterThan(0);
    expect([4, 8, 16, 24]).toContain(r.plan[0].item.poe_ports);
  });
});
