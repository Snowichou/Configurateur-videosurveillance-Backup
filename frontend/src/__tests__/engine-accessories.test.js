// ============================================================
// Tests engine/accessories.js — Sélection des accessoires
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBlockAccessories, buildAccessoryLines } from '../engine/accessories.js';

const cam = { id: 'CAM-1' };
const mapRow = (o = {}) => ({
  junction: { id: 'JB-1', type: 'junction_box', name: 'Boîtier de jonction' },
  wall: { id: 'WM-1', type: 'wall_mount', name: 'Support mural' },
  ceiling: { id: 'CM-1', type: 'ceiling_mount', name: 'Support plafond' },
  qty: 1,
  ...o,
});

describe('computeBlockAccessories', () => {
  it('caméra absente → []', () => {
    expect(computeBlockAccessories({ cam: null, mapRow: mapRow(), mounting: 'wall' })).toEqual([]);
  });

  it('mapRow absente → []', () => {
    expect(computeBlockAccessories({ cam, mapRow: null, mounting: 'wall' })).toEqual([]);
  });

  it('pose murale → boîtier de jonction + support mural', () => {
    const r = computeBlockAccessories({ cam, mapRow: mapRow(), mounting: 'wall', camQty: 1 });
    const ids = r.map((l) => l.accessoryId);
    expect(ids).toContain('JB-1');
    expect(ids).toContain('WM-1');
    expect(ids).not.toContain('CM-1');
  });

  it('pose plafond → boîtier de jonction + support plafond', () => {
    const r = computeBlockAccessories({ cam, mapRow: mapRow(), mounting: 'ceiling', camQty: 1 });
    const ids = r.map((l) => l.accessoryId);
    expect(ids).toContain('CM-1');
    expect(ids).not.toContain('WM-1');
  });

  it('plafond demandé mais absent → repli sur support mural', () => {
    const r = computeBlockAccessories({
      cam,
      mapRow: mapRow({ ceiling: null }),
      mounting: 'ceiling',
      camQty: 1,
    });
    expect(r.map((l) => l.accessoryId)).toContain('WM-1');
  });

  it('quantité = qty caméra × multiplicateur de la ligne de mapping', () => {
    const r = computeBlockAccessories({ cam, mapRow: mapRow({ qty: 2 }), mounting: 'wall', camQty: 3 });
    expect(r.every((l) => l.qty === 6)).toBe(true);
  });

  it('pas de boîtier de jonction dans la mapRow → seulement le support', () => {
    const r = computeBlockAccessories({
      cam,
      mapRow: mapRow({ junction: null }),
      mounting: 'wall',
      camQty: 1,
    });
    expect(r).toHaveLength(1);
    expect(r[0].accessoryId).toBe('WM-1');
  });

  it('linkedCameraId = id de la caméra', () => {
    const r = computeBlockAccessories({ cam, mapRow: mapRow(), mounting: 'wall', camQty: 1 });
    expect(r.every((l) => l.linkedCameraId === 'CAM-1')).toBe(true);
  });

  it('dédoublonnage : même type+id agrège les quantités', () => {
    // junction et wall pointent sur le même accessoire → fusion
    const same = { id: 'X-1', type: 'wall_mount', name: 'Accessoire' };
    const r = computeBlockAccessories({
      cam,
      mapRow: { junction: same, wall: same, ceiling: null, qty: 1 },
      mounting: 'wall',
      camQty: 2,
    });
    expect(r).toHaveLength(1);
    expect(r[0].qty).toBe(4); // 2 lignes × (camQty 2 × mult 1)
  });
});

describe('buildAccessoryLines', () => {
  const block = (o = {}) => ({
    id: 'B1',
    validated: true,
    accessories: [
      { type: 'junction_box', accessoryId: 'JB-1', name: 'Boîtier', qty: 2 },
      { type: 'wall_mount', accessoryId: 'WM-1', name: 'Support', qty: 2 },
    ],
    ...o,
  });

  it('aplatit les accessoires des blocs validés', () => {
    const r = buildAccessoryLines([block()], [{ fromBlockId: 'B1', cameraId: 'CAM-1' }]);
    expect(r).toHaveLength(2);
    expect(r[0].fromBlockId).toBe('B1');
  });

  it('ignore les blocs non validés', () => {
    const r = buildAccessoryLines([block({ validated: false })], []);
    expect(r).toEqual([]);
  });

  it('linkedCameraId : repli sur la caméra de la ligne du bloc', () => {
    const r = buildAccessoryLines([block()], [{ fromBlockId: 'B1', cameraId: 'CAM-9' }]);
    expect(r.every((l) => l.linkedCameraId === 'CAM-9')).toBe(true);
  });

  it('linkedCameraId explicite conservé', () => {
    const b = block();
    b.accessories[0].linkedCameraId = 'CAM-EXPLICIT';
    const r = buildAccessoryLines([b], [{ fromBlockId: 'B1', cameraId: 'CAM-9' }]);
    expect(r[0].linkedCameraId).toBe('CAM-EXPLICIT');
  });

  it('entrées vides ou nulles → []', () => {
    expect(buildAccessoryLines([], [])).toEqual([]);
    expect(buildAccessoryLines(null, null)).toEqual([]);
  });
});
