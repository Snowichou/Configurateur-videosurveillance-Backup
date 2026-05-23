// ============================================================
// Tests engine — Storage / HDD
// ============================================================
//
// Phase 1 refactor — les fonctions sont maintenant importées
// depuis le module ESM `src/engine/storage.js` (plus de mirror).
//
// Ces tests vérifient à la fois :
//   1. Le comportement métier (formule mbpsToTB, algo pickDisks, motion)
//   2. La non-régression après extraction depuis app.js
// ============================================================

import { describe, it, expect } from 'vitest';
import { mbpsToTB, getContextualMotionFactor, pickDisks } from '../engine/storage.js';

// ─── Fixtures de test ────────────────────────────────────────
const HDDS_CATALOG = [
  { id: 'WDSK324A', capacity_tb: 1 },
  { id: 'WDSK325A', capacity_tb: 2 },
  { id: 'WDSK327A', capacity_tb: 4 },
  { id: 'WDSK329A', capacity_tb: 8 },
];

const NVR_NEXT_8 = { id: 'NEXT-8', hdd_bays: 1, max_hdd_tb_per_bay: 10 };
const NVR_ADV_16 = { id: 'ADV-16', hdd_bays: 2, max_hdd_tb_per_bay: 10 };
const NVR_ADV_32 = { id: 'ADV-32', hdd_bays: 8, max_hdd_tb_per_bay: 10 };

// ─── Tests mbpsToTB ─────────────────────────────────────────
describe('mbpsToTB — formule de conversion débit → stockage', () => {
  it('100 Mbps × 24h × 14j × 15% overhead → ~17.4 To', () => {
    // Formule : 100 × 1e6 × (24×3600×14) / 8 / 1e12 × 1.15 = 17.388 To
    const tb = mbpsToTB(100, 24, 14, 15);
    expect(tb).toBeGreaterThan(17);
    expect(tb).toBeLessThan(18);
  });

  it('1 Mbps × 1h × 1j × 0% overhead → 0.00045 To (~450 Mo)', () => {
    const tb = mbpsToTB(1, 1, 1, 0);
    // 1 Mbps × 3600 s × 1 Mb = 3600 Mb = 450 Mo = 0.00045 To
    expect(tb).toBeCloseTo(0.00045, 5);
  });

  it('0 Mbps → 0 To (cas dégénéré)', () => {
    expect(mbpsToTB(0, 24, 14, 15)).toBe(0);
  });

  it('overhead augmente proportionnellement le résultat', () => {
    const tb0 = mbpsToTB(50, 24, 14, 0);
    const tb20 = mbpsToTB(50, 24, 14, 20);
    expect(tb20).toBeCloseTo(tb0 * 1.2, 5);
  });

  it('résultat est en base 10 (SI), pas base 2 (binaire)', () => {
    // 1 Gbps × 3600s = 3.6 × 10^12 bits = 0.45 × 10^12 bytes = 0.45 To (SI)
    const tb = mbpsToTB(1000, 1, 1, 0);
    expect(tb).toBeCloseTo(0.45, 3);
  });
});

// ─── Tests getContextualMotionFactor ────────────────────────
describe('getContextualMotionFactor — facteur motion contextualisé (HDD.4)', () => {
  it('fallback 0.4 si pas de bloc', () => {
    expect(getContextualMotionFactor(null, 'Tertiaire')).toBe(0.4);
    expect(getContextualMotionFactor(undefined, 'Tertiaire')).toBe(0.4);
  });

  it('intérieur résidentiel ≈ 0.255 (0.30 × 0.85)', () => {
    const blk = { answers: { emplacement: 'interieur' } };
    const f = getContextualMotionFactor(blk, 'Résidentiel');
    expect(f).toBeCloseTo(0.255, 2);
  });

  it('intérieur tertiaire = 0.30 (0.30 × 1.00)', () => {
    const blk = { answers: { emplacement: 'interieur' } };
    expect(getContextualMotionFactor(blk, 'Tertiaire')).toBeCloseTo(0.3, 2);
  });

  it('extérieur parking ≈ 0.575 (0.50 × 1.15)', () => {
    const blk = { answers: { emplacement: 'exterieur' } };
    expect(getContextualMotionFactor(blk, 'Parking')).toBeCloseTo(0.575, 2);
  });

  it('extérieur industriel ≈ 0.55 (0.50 × 1.10)', () => {
    const blk = { answers: { emplacement: 'exterieur' } };
    expect(getContextualMotionFactor(blk, 'Industriel')).toBeCloseTo(0.55, 2);
  });

  it('borne basse [0.20, 0.70]', () => {
    const f1 = getContextualMotionFactor({ answers: { emplacement: 'interieur' } }, 'Résidentiel');
    expect(f1).toBeGreaterThanOrEqual(0.2);
    const f2 = getContextualMotionFactor({ answers: { emplacement: 'exterieur' } }, 'Parking');
    expect(f2).toBeLessThanOrEqual(0.7);
  });

  it('détection multi-langues : "Wohngebäude" comme "Résidentiel"', () => {
    const blk = { answers: { emplacement: 'interieur' } };
    const fr = getContextualMotionFactor(blk, 'Résidentiel');
    const de = getContextualMotionFactor(blk, 'Wohngebäude');
    expect(fr).toBeCloseTo(de, 3);
  });

  it('use_case inconnu → facteur de base sans modulation', () => {
    const blk = { answers: { emplacement: 'interieur' } };
    expect(getContextualMotionFactor(blk, 'UseCaseInconnuXYZ')).toBeCloseTo(0.3, 2);
  });
});

// ─── Tests pickDisks (mixed sizes) ──────────────────────────
describe('pickDisks — algorithme mixed-sizes (HDD.3)', () => {
  it('NVR sans baies → fallback safe', () => {
    const r = pickDisks(5, { hdd_bays: 0, max_hdd_tb_per_bay: 10 }, HDDS_CATALOG);
    expect(r).toBeTruthy();
    expect(r.count).toBeGreaterThanOrEqual(1);
  });

  it('besoin 5 To, NVR 1 bay max 10 To → 1× 8 To (greedy)', () => {
    const r = pickDisks(5, NVR_NEXT_8, HDDS_CATALOG);
    expect(r.sizeTB).toBe(8);
    expect(r.count).toBe(1);
    expect(r.totalTB).toBe(8);
    expect(r.mixed).toBe(false);
  });

  it('besoin 5 To, NVR 2 bays → mixed 4+1=5 To exact (préféré à 1× 8 To)', () => {
    const r = pickDisks(5, NVR_ADV_16, HDDS_CATALOG);
    expect(r.mixed).toBe(true);
    expect(r.totalTB).toBe(5);
    expect(r.composition).toHaveLength(2);
    // Tri par taille décroissante
    expect(r.composition[0]).toMatchObject({ sizeTB: 4, count: 1 });
    expect(r.composition[1]).toMatchObject({ sizeTB: 1, count: 1 });
  });

  it('besoin 8 To, NVR 1 bay → 1× 8 To (single optimal)', () => {
    const r = pickDisks(8, NVR_NEXT_8, HDDS_CATALOG);
    expect(r.sizeTB).toBe(8);
    expect(r.count).toBe(1);
    expect(r.mixed).toBe(false);
  });

  it('besoin 16 To, NVR 2 bays max 10/bay → 2× 8 To (mixed inutile car égalité)', () => {
    const r = pickDisks(16, NVR_ADV_16, HDDS_CATALOG);
    expect(r.totalTB).toBe(16);
    expect(r.count).toBe(2);
  });

  it('besoin 60 To, NVR 8 bays max 10/bay → mixed 7×8+1×4 = 60 To (waste 0)', () => {
    // Algo HDD.3 préfère mixed-sizes si gain > 5% sur le gaspillage
    // Single : 8×8 = 64 To (waste 4) ; Mixed : 7×8 + 1×4 = 60 To (waste 0) → mixed gagne
    const r = pickDisks(60, NVR_ADV_32, HDDS_CATALOG);
    expect(r.totalTB).toBe(60);
    expect(r.count).toBe(8);
    expect(r.mixed).toBe(true);
  });

  it('besoin dépasse capacité max → remplit toutes les baies', () => {
    const r = pickDisks(200, NVR_ADV_16, HDDS_CATALOG); // max 20 To
    expect(r.totalTB).toBeLessThanOrEqual(r.maxTotalTB);
    expect(r.count).toBeLessThanOrEqual(NVR_ADV_16.hdd_bays);
  });

  it('maxTotalTB est calculé correctement (bays × max/bay)', () => {
    const r = pickDisks(1, NVR_ADV_32, HDDS_CATALOG);
    expect(r.maxTotalTB).toBe(80); // 8 bays × 10 To
  });

  it('composition.count1 × size1 + count2 × size2 === totalTB (intégrité)', () => {
    const r = pickDisks(13, NVR_ADV_16, HDDS_CATALOG);
    const sumFromComposition = r.composition.reduce((s, c) => s + c.sizeTB * c.count, 0);
    expect(sumFromComposition).toBe(r.totalTB);
  });

  it('catalogue HDD limité : taille au-dessus de max_per_bay ignorée', () => {
    const r = pickDisks(5, { hdd_bays: 1, max_hdd_tb_per_bay: 3 }, HDDS_CATALOG);
    // max 3 To/bay → seul 1 et 2 To sont candidates
    expect(r.sizeTB).toBeLessThanOrEqual(3);
  });
});
