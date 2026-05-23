// ============================================================
// Tests state/lookups.js — Lookups catalogue purs
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  findById,
  getCameraById,
  getNvrById,
  getHddById,
  getSwitchById,
  getScreenById,
  getEnclosureById,
  getAllUseCases,
} from '../state/lookups.js';

// ─── findById ───────────────────────────────────────────────
describe('findById', () => {
  const items = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ];

  it('trouve un élément existant', () => {
    expect(findById(items, 'b')).toEqual({ id: 'b', name: 'Beta' });
  });

  it('id inconnu → null', () => {
    expect(findById(items, 'z')).toBeNull();
  });

  it('tableau vide → null', () => {
    expect(findById([], 'a')).toBeNull();
  });

  it('items non-array → null', () => {
    expect(findById(null, 'a')).toBeNull();
    expect(findById(undefined, 'a')).toBeNull();
    expect(findById('foo', 'a')).toBeNull();
  });

  it('id null/empty → null', () => {
    expect(findById(items, null)).toBeNull();
    expect(findById(items, '')).toBeNull();
    expect(findById(items, undefined)).toBeNull();
  });

  it('ignore les entrées falsy dans le tableau', () => {
    expect(findById([null, { id: 'a' }], 'a')).toEqual({ id: 'a' });
  });
});

// ─── getCameraById / NVR / HDD / Switch / Screen / Enclosure ─
describe('lookups par id (alias de findById)', () => {
  it('getCameraById', () => {
    const cams = [{ id: 'cam1' }, { id: 'cam2' }];
    expect(getCameraById('cam2', cams)).toEqual({ id: 'cam2' });
    expect(getCameraById('nope', cams)).toBeNull();
  });

  it('getNvrById', () => {
    const nvrs = [{ id: 'nvr1' }];
    expect(getNvrById('nvr1', nvrs).id).toBe('nvr1');
  });

  it('getHddById', () => {
    expect(getHddById('h', [{ id: 'h', capacity_tb: 8 }]).capacity_tb).toBe(8);
  });

  it('getSwitchById', () => {
    expect(getSwitchById('sw', [{ id: 'sw' }])).toBeTruthy();
  });

  it('getScreenById', () => {
    expect(getScreenById('s', [{ id: 's' }])).toBeTruthy();
  });

  it('getEnclosureById', () => {
    expect(getEnclosureById('e', [{ id: 'e' }])).toBeTruthy();
  });
});

// ─── getAllUseCases ─────────────────────────────────────────
describe('getAllUseCases', () => {
  it('agrège et déduplique tous les use_cases', () => {
    const cams = [
      { id: 'c1', use_cases: ['Résidentiel', 'Tertiaire'] },
      { id: 'c2', use_cases: ['Tertiaire', 'Parking'] },
      { id: 'c3', use_cases: ['Industriel'] },
    ];
    const out = getAllUseCases(cams);
    expect(out).toContain('Résidentiel');
    expect(out).toContain('Tertiaire');
    expect(out).toContain('Parking');
    expect(out).toContain('Industriel');
    expect(out).toHaveLength(4); // dédupliqué
  });

  it('trié locale FR (avec accents)', () => {
    const cams = [
      { id: 'c1', use_cases: ['Zoo', 'Résidentiel', 'Industriel', 'École'] },
    ];
    const out = getAllUseCases(cams);
    // École doit venir avant Industriel (E < I)
    expect(out.indexOf('École')).toBeLessThan(out.indexOf('Industriel'));
  });

  it('false-like ignoré', () => {
    const cams = [{ id: 'c1', use_cases: ['Résidentiel', 'false', '', null] }];
    expect(getAllUseCases(cams)).toEqual(['Résidentiel']);
  });

  it('tableau vide / null → []', () => {
    expect(getAllUseCases([])).toEqual([]);
    expect(getAllUseCases(null)).toEqual([]);
    expect(getAllUseCases(undefined)).toEqual([]);
  });

  it('caméras sans use_cases → ignorées', () => {
    expect(getAllUseCases([{ id: 'c1' }, { id: 'c2' }])).toEqual([]);
  });

  it('trim les valeurs', () => {
    const cams = [{ id: 'c1', use_cases: ['  Résidentiel  ', 'Tertiaire'] }];
    const out = getAllUseCases(cams);
    expect(out).toContain('Résidentiel');
    expect(out).not.toContain('  Résidentiel  ');
  });
});
