// ============================================================
// Tests engine — NVR + Switches PoE (Phase 0)
// ============================================================
//
// Stratégie identique à engine-storage.test.js : on RÉIMPLÉMENTE
// localement les fonctions critiques (versions PURES qui prennent
// les catalogues en paramètres au lieu de globals) pour pouvoir
// les tester. À l'extraction modulaire, on remplacera par des
// imports.
// ============================================================

import { describe, it, expect } from 'vitest';
import { planPoESwitches } from '../engine/poe.js';
import { pickNvr } from '../engine/pick-nvr.js';

// Note : pickNvr et planPoESwitches sont importés depuis les modules ESM (Phase 1).

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

const blockNext = { answers: { ai_type: 'next', emplacement: 'interieur' }, validated: true };
const blockAdvance = { answers: { ai_type: 'advance', emplacement: 'exterieur' }, validated: true };

// ─── Tests pickNvr ──────────────────────────────────────────
describe('pickNvr — sélection NVR avec règle métier NEXT/ADVANCE', () => {
  it('4 cams NEXT → NVR NEXT 4ch', () => {
    const r = pickNvr(4, 30, 1, [blockNext], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.id).toBe('NEXT-4');
    expect(r.hasAdvanceBlock).toBe(false);
    expect(r.usedRange).toBe('NEXT');
    expect(r.upgradedFromNext).toBe(false);
  });

  it('4 cams ADVANCE → NVR ADVANCE 4ch (même si NEXT existe)', () => {
    const r = pickNvr(4, 30, 1, [blockAdvance], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.id).toBe('ADV-4');
    expect(r.hasAdvanceBlock).toBe(true);
    expect(r.requiredRange).toBe('ADVANCE');
  });

  it('1 bloc NEXT + 1 bloc ADVANCE → forcement ADVANCE', () => {
    const r = pickNvr(8, 60, 1, [blockNext, blockAdvance], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.brand_range).toBe('ADVANCE');
    expect(r.hasAdvanceBlock).toBe(true);
  });

  it('20 cams tout-NEXT → auto-upgrade vers ADVANCE (NEXT max = 16ch)', () => {
    const r = pickNvr(20, 100, 1, [blockNext], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.brand_range).toBe('ADVANCE');
    expect(r.nvr.channels).toBeGreaterThanOrEqual(20);
    expect(r.upgradedFromNext).toBe(true);
    expect(r.requiredRange).toBe('NEXT'); // ce qui était demandé
    expect(r.usedRange).toBe('ADVANCE'); // ce qui est utilisé
  });

  it('16 cams tout-NEXT → reste en NEXT (16ch dispo)', () => {
    const r = pickNvr(16, 100, 1, [blockNext], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.id).toBe('NEXT-16');
    expect(r.upgradedFromNext).toBe(false);
  });

  it('500 cams → aucun NVR ne couvre → renvoie null', () => {
    const r = pickNvr(500, 100, 1, [blockAdvance], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr).toBeNull();
    expect(r.alternatives).toEqual([]);
  });

  it('alternatives retournées dans même gamme', () => {
    const r = pickNvr(4, 30, 1, [blockAdvance], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives.every((alt) => alt.brand_range === 'ADVANCE')).toBe(true);
  });

  it("stockage important → préfère NVR avec plus de baies", () => {
    // Besoin 30 To → 30/8 = 4 baies min. Le NVR ADV-16 (2 baies) ne suffit pas.
    const r = pickNvr(16, 200, 30, [blockAdvance], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.hdd_bays).toBeGreaterThanOrEqual(4);
  });

  it("aucun bloc validé → traité comme NEXT par défaut", () => {
    const r = pickNvr(4, 30, 1, [], CATALOG_NVRS, CATALOG_HDDS);
    expect(r.nvr.brand_range).toBe('NEXT');
    expect(r.hasAdvanceBlock).toBe(false);
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
    const r = planPoESwitches(24, 0, nvr, CATALOG_SWITCHES); // 24 cams, 16 sur NVR + 8 sur switch
    expect(r.required).toBe(true);
    expect(r.portsNeeded).toBe(8);
    expect(r.totalPorts).toBeGreaterThanOrEqual(8);
  });

  it("greedy : préfère les grands switches d'abord", () => {
    const nvr = { id: 'ADV-32', poe_ports: 0 };
    const r = planPoESwitches(40, 0, nvr, CATALOG_SWITCHES);
    expect(r.plan[0].item.poe_ports).toBe(24); // premier switch = le plus gros
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
