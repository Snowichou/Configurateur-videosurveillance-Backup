// ============================================================
// Tests catalog/normalize.js — Helpers & normalizers CSV
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  safeStr,
  safeNum,
  splitList,
  parsePipeList,
  localizedDatasheetUrl,
  normalizeHdd,
  normalizeSwitch,
  normalizeScreen,
  normalizeEnclosure,
  normalizeSignageRow,
  parseRobustNum,
  extractUseCasesFromRow,
  normalizeCamera,
  normalizeNvr,
  normalizeMappedAccessory,
  normalizeAccessoryMapping,
} from '../catalog/normalize.js';

// ─── safeStr ────────────────────────────────────────────────
describe('safeStr', () => {
  it('null/undefined → ""', () => {
    expect(safeStr(null)).toBe('');
    expect(safeStr(undefined)).toBe('');
  });

  it('trim espaces', () => {
    expect(safeStr('  hello  ')).toBe('hello');
  });

  it('convertit nombre en string', () => {
    expect(safeStr(42)).toBe('42');
  });

  it('bool en string', () => {
    expect(safeStr(false)).toBe('false');
    expect(safeStr(true)).toBe('true');
  });
});

// ─── safeNum ────────────────────────────────────────────────
describe('safeNum', () => {
  it('nombre standard', () => {
    expect(safeNum('42')).toBe(42);
    expect(safeNum(42)).toBe(42);
  });

  it('virgule décimale → point', () => {
    expect(safeNum('15,5')).toBe(15.5);
  });

  it('non numérique → null', () => {
    expect(safeNum('abc')).toBeNull();
    expect(safeNum('—')).toBeNull();
  });

  it('null/undefined → null (Number("") === 0 finite)', () => {
    // Note : safeNum gère "" via toString = "" → Number("") = 0 → 0 retourné
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
  });
});

// ─── splitList ──────────────────────────────────────────────
describe('splitList', () => {
  it('split classique', () => {
    expect(splitList('A|B|C')).toEqual(['A', 'B', 'C']);
  });

  it('trim chaque élément', () => {
    expect(splitList('A | B|C ')).toEqual(['A', 'B', 'C']);
  });

  it('filtre vides', () => {
    expect(splitList('A||B|')).toEqual(['A', 'B']);
  });

  it('null/empty → []', () => {
    expect(splitList(null)).toEqual([]);
    expect(splitList('')).toEqual([]);
    expect(splitList('   ')).toEqual([]);
  });

  it('séparateur custom', () => {
    expect(splitList('A,B,C', ',')).toEqual(['A', 'B', 'C']);
  });
});

// ─── parsePipeList ──────────────────────────────────────────
describe('parsePipeList', () => {
  it('"A|B|C|" → ["A","B","C"]', () => {
    expect(parsePipeList('A|B|C|')).toEqual(['A', 'B', 'C']);
  });
});

// ─── localizedDatasheetUrl ──────────────────────────────────
describe('localizedDatasheetUrl', () => {
  it('lang=en → /en_GB/', () => {
    expect(localizedDatasheetUrl('/data/fr_FR/manual.pdf', 'en')).toBe('/data/en_GB/manual.pdf');
  });

  it('lang=it → /it_IT/ (underscore) et /it-it/ (dash)', () => {
    expect(localizedDatasheetUrl('/data/fr-fr/manual.pdf', 'it')).toBe('/data/it-it/manual.pdf');
    expect(localizedDatasheetUrl('/data/fr_FR/manual.pdf', 'it')).toBe('/data/it_IT/manual.pdf');
  });

  it('lang=fr (défaut) → inchangé', () => {
    expect(localizedDatasheetUrl('/data/fr_FR/manual.pdf', 'fr')).toBe('/data/fr_FR/manual.pdf');
  });

  it('url vide ou "false" → inchangée', () => {
    expect(localizedDatasheetUrl('', 'en')).toBe('');
    expect(localizedDatasheetUrl('false', 'en')).toBe('false');
  });

  it('lang inconnue → fallback fr', () => {
    expect(localizedDatasheetUrl('/data/fr_FR/manual.pdf', 'jp')).toBe('/data/fr_FR/manual.pdf');
  });
});

// ─── normalizeHdd ───────────────────────────────────────────
describe('normalizeHdd', () => {
  it('normalise une ligne HDD complète', () => {
    const raw = {
      id: 'HDD-8',
      name: 'WD Purple 8TB',
      capacity_tb: '8',
      image_url: '/img/wd8.png',
      datasheet_url: '/data/fr_FR/wd8.pdf',
    };
    const n = normalizeHdd(raw);
    expect(n.id).toBe('HDD-8');
    expect(n.capacity_tb).toBe(8);
    expect(n.name).toBe('WD Purple 8TB');
  });

  it('utilise localizedName injecté', () => {
    const raw = { id: 'X', name: 'fr-name', name_en: 'en-name', capacity_tb: 2 };
    const localizedName = (r) => r.name_en || r.name;
    expect(normalizeHdd(raw, localizedName).name).toBe('en-name');
  });
});

// ─── normalizeSwitch ────────────────────────────────────────
describe('normalizeSwitch', () => {
  it('normalise un switch PoE', () => {
    const raw = {
      id: 'SW-24',
      name: 'Switch 24 ports',
      poe_ports: '24',
      poe_budget_w: '360',
      uplink_gbps: '2',
      managed: 'true',
    };
    const n = normalizeSwitch(raw);
    expect(n.poe_ports).toBe(24);
    expect(n.poe_budget_w).toBe(360);
    expect(n.uplink_gbps).toBe(2);
    expect(n.managed).toBe(true);
  });

  it('managed truthy/falsy', () => {
    expect(normalizeSwitch({ id: 'X', managed: '1' }).managed).toBe(true);
    expect(normalizeSwitch({ id: 'X', managed: 'yes' }).managed).toBe(true);
    expect(normalizeSwitch({ id: 'X', managed: 'no' }).managed).toBe(false);
    expect(normalizeSwitch({ id: 'X' }).managed).toBe(false);
  });

  it('poe_ports manquant → 0', () => {
    expect(normalizeSwitch({ id: 'X' }).poe_ports).toBe(0);
  });
});

// ─── normalizeScreen ────────────────────────────────────────
describe('normalizeScreen', () => {
  it('normalise un écran 55"', () => {
    const raw = {
      id: 'SCR-55',
      name: 'Écran 55"',
      size_inch: '55',
      format: '16:9',
      vesa: '400x400',
      Resolution: '4K',
    };
    const n = normalizeScreen(raw);
    expect(n.size_inch).toBe(55);
    expect(n.resolution).toBe('4K');
  });

  it('size_inch invalide → null (pas 0)', () => {
    expect(normalizeScreen({ id: 'X', size_inch: '' }).size_inch).toBeNull();
    expect(normalizeScreen({ id: 'X', size_inch: 'abc' }).size_inch).toBeNull();
    expect(normalizeScreen({ id: 'X', size_inch: '0' }).size_inch).toBeNull();
  });

  it('size_inch en virgule décimale', () => {
    expect(normalizeScreen({ id: 'X', size_inch: '32,5' }).size_inch).toBe(32.5);
  });

  it('valeurs manquantes → "—"', () => {
    const n = normalizeScreen({ id: 'X' });
    expect(n.format).toBe('—');
    expect(n.vesa).toBe('—');
    expect(n.resolution).toBe('—');
  });
});

// ─── normalizeEnclosure ─────────────────────────────────────
describe('normalizeEnclosure', () => {
  it('parse les listes compatible_with', () => {
    const raw = {
      id: 'ENC-1',
      name: 'Boîtier mural',
      screen_compatible_with: 'SCR-32|SCR-43|SCR-55',
      compatible_with: 'NVR-8|NVR-16',
    };
    const n = normalizeEnclosure(raw);
    expect(n.screen_compatible_with).toEqual(['SCR-32', 'SCR-43', 'SCR-55']);
    expect(n.compatible_with).toEqual(['NVR-8', 'NVR-16']);
  });

  it('listes vides → []', () => {
    const n = normalizeEnclosure({ id: 'X' });
    expect(n.screen_compatible_with).toEqual([]);
    expect(n.compatible_with).toEqual([]);
  });
});

// ─── normalizeSignageRow ────────────────────────────────────
describe('normalizeSignageRow', () => {
  it('normalise un panneau CNIL Public', () => {
    const raw = {
      id: 'SIGN-A4',
      name: 'Panneau A4',
      material: 'PVC',
      fixing: 'adhésif',
      Dimension: 'A4',
      Prive_Public: 'Public',
    };
    const n = normalizeSignageRow(raw);
    expect(n.id).toBe('SIGN-A4');
    expect(n.scope).toBe('Public');
    expect(n.dimension).toBe('A4');
  });

  it('null/sans id → null', () => {
    expect(normalizeSignageRow(null)).toBeNull();
    expect(normalizeSignageRow({})).toBeNull();
    expect(normalizeSignageRow({ id: '' })).toBeNull();
  });

  it('scope par défaut → "Public"', () => {
    const n = normalizeSignageRow({ id: 'X', name: 'Y' });
    expect(n.scope).toBe('Public');
  });

  it('accepte plusieurs aliases pour scope/dimension', () => {
    const n1 = normalizeSignageRow({ id: 'A', scope: 'Privé' });
    expect(n1.scope).toBe('Privé');
    const n2 = normalizeSignageRow({ id: 'A', dimension: 'A3' });
    expect(n2.dimension).toBe('A3');
  });
});

// ─── parseRobustNum (PH1.9b) ────────────────────────────────
describe('parseRobustNum', () => {
  it('nombre standard', () => {
    expect(parseRobustNum(42)).toBe(42);
    expect(parseRobustNum('42')).toBe(42);
  });

  it('virgule décimale FR', () => {
    expect(parseRobustNum('1,5')).toBe(1.5);
    expect(parseRobustNum('0,75')).toBe(0.75);
  });

  it('codes IP/IK → extrait le nombre', () => {
    expect(parseRobustNum('IP66')).toBe(66);
    expect(parseRobustNum('IK10')).toBe(10);
    expect(parseRobustNum('IP 67')).toBe(67);
    expect(parseRobustNum('ik08')).toBe(8);
  });

  it('null / undefined / "" → fallback', () => {
    expect(parseRobustNum(null)).toBeNull();
    expect(parseRobustNum(undefined)).toBeNull();
    expect(parseRobustNum('')).toBeNull();
    expect(parseRobustNum(null, 0)).toBe(0);
  });

  it('non numérique → fallback', () => {
    expect(parseRobustNum('abc', 99)).toBe(99);
    expect(parseRobustNum('—', null)).toBeNull();
  });

  it('NaN explicite → fallback', () => {
    expect(parseRobustNum(NaN, 0)).toBe(0);
  });
});

// ─── extractUseCasesFromRow (PH1.9b) ────────────────────────
describe('extractUseCasesFromRow', () => {
  it('lit use_cases_01..03', () => {
    const raw = { use_cases_01: 'Résidentiel', use_cases_02: 'Tertiaire', use_cases_03: 'Parking' };
    expect(extractUseCasesFromRow(raw)).toEqual(['Résidentiel', 'Tertiaire', 'Parking']);
  });

  it('false-like ignoré', () => {
    const raw = { use_cases_01: 'Résidentiel', use_cases_02: 'false', use_cases_03: '' };
    expect(extractUseCasesFromRow(raw)).toEqual(['Résidentiel']);
  });

  it('fallback legacy "A|B|C"', () => {
    const raw = { use_cases: 'Résidentiel|Tertiaire' };
    expect(extractUseCasesFromRow(raw)).toEqual(['Résidentiel', 'Tertiaire']);
  });

  it('fallback legacy "use_case" singulier', () => {
    expect(extractUseCasesFromRow({ use_case: 'Parking' })).toEqual(['Parking']);
  });

  it('aucun → []', () => {
    expect(extractUseCasesFromRow({})).toEqual([]);
  });

  it('déduplique', () => {
    const raw = { use_cases_01: 'A', use_cases_02: 'A', use_cases_03: 'B' };
    expect(extractUseCasesFromRow(raw)).toEqual(['A', 'B']);
  });
});

// ─── normalizeCamera (PH1.9b) ───────────────────────────────
describe('normalizeCamera', () => {
  it('normalise une caméra complète', () => {
    const raw = {
      id: 'CAM-1',
      name: 'Dome 4MP',
      brand_range: 'ADVANCE',
      form_factor: 'dome',
      Emplacement_Exterieur: 'true',
      resolution_mp: '4',
      ir_range_m: '30',
      ip: 'IP67',
      ik: 'IK10',
      dori_identification_m: '15,5',
      bitrate_mbps_typical: '4,5',
      use_cases_01: 'Tertiaire',
      poe_w: 12,
    };
    const n = normalizeCamera(raw);
    expect(n.id).toBe('CAM-1');
    expect(n.brand_range).toBe('ADVANCE');
    expect(n.type).toBe('dome');
    expect(n.emplacement_exterieur).toBe(true);
    expect(n.emplacement_interieur).toBe(false);
    expect(n.resolution_mp).toBe(4);
    expect(n.ir_range_m).toBe(30);
    expect(n.ip).toBe(67);
    expect(n.ik).toBe(10);
    expect(n.dori_identification_m).toBe(15.5);
    expect(n.bitrate_mbps_typical).toBe(4.5);
    expect(n.use_cases).toEqual(['Tertiaire']);
    expect(n.poe_w).toBe(12);
  });

  it('valeurs manquantes → defaults sains', () => {
    const n = normalizeCamera({ id: 'X' });
    expect(n.resolution_mp).toBe(0);
    expect(n.dori_detection_m).toBe(0);
    expect(n.ip).toBeNull();
    expect(n.ik).toBeNull();
    expect(n.bitrate_mbps_typical).toBeNull();
    expect(n.use_cases).toEqual([]);
  });

  it('legacy field "type" si pas de form_factor', () => {
    expect(normalizeCamera({ id: 'X', type: 'bullet' }).type).toBe('bullet');
  });

  it('utilise localizedName injecté', () => {
    const raw = { id: 'X', name: 'fr-name', name_en: 'en-name' };
    const ln = (r) => r.name_en || r.name;
    expect(normalizeCamera(raw, ln).name).toBe('en-name');
  });
});

// ─── normalizeNvr (PH1.9b) ──────────────────────────────────
describe('normalizeNvr', () => {
  it('normalise un NVR complet', () => {
    const raw = {
      id: 'NVR-32',
      name: 'NVR 32ch',
      brand_range: 'ADVANCE',
      channels: '32',
      max_in_mbps: '320',
      nvr_output: '2',
      hdd_bays: '8',
      max_hdd_tb_per_bay: '10',
      poe_ports: '0',
      poe_budget_w: '0',
    };
    const n = normalizeNvr(raw);
    expect(n.brand_range).toBe('ADVANCE');
    expect(n.channels).toBe(32);
    expect(n.max_in_mbps).toBe(320);
    expect(n.nvr_output).toBe(2);
    expect(n.hdd_bays).toBe(8);
  });

  it('nvr_output borné [1, 8]', () => {
    expect(normalizeNvr({ id: 'X', nvr_output: 0 }).nvr_output).toBe(1);
    expect(normalizeNvr({ id: 'X', nvr_output: 99 }).nvr_output).toBe(8);
    expect(normalizeNvr({ id: 'X' }).nvr_output).toBe(1);
  });

  it('brand_range trim + string', () => {
    expect(normalizeNvr({ id: 'X', brand_range: '  NEXT  ' }).brand_range).toBe('NEXT');
    expect(normalizeNvr({ id: 'X' }).brand_range).toBe('');
  });
});

// ─── normalizeMappedAccessory (PH1.9b) ──────────────────────
describe('normalizeMappedAccessory', () => {
  it('normalise un accessoire valide', () => {
    const n = normalizeMappedAccessory({
      id: 'JB-1',
      name: 'Junction box',
      type: 'junction_box',
      image_url: '/img/jb1.png',
      datasheet_url: '/data/jb1.pdf',
      stand_alone: true,
    });
    expect(n.id).toBe('JB-1');
    expect(n.type).toBe('junction_box');
    expect(n.stand_alone).toBe(true);
  });

  it('id false-like → null', () => {
    expect(normalizeMappedAccessory({ id: 'false', name: 'X' })).toBeNull();
    expect(normalizeMappedAccessory({ id: '', name: 'X' })).toBeNull();
    expect(normalizeMappedAccessory({ id: undefined, name: 'X' })).toBeNull();
  });

  it('name fallback sur id', () => {
    const n = normalizeMappedAccessory({ id: 'JB-1', type: 'junction_box' });
    expect(n.name).toBe('JB-1');
  });
});

// ─── normalizeAccessoryMapping (PH1.9b) ─────────────────────
describe('normalizeAccessoryMapping', () => {
  it('parse une ligne complète', () => {
    const raw = {
      camera_id: 'CAM-1',
      qty: 2,
      junction_box_id: 'JB-1',
      junction_box_name: 'Junction',
      wall_mount_id: 'WM-1',
      wall_mount_name: 'Wall mount',
      wall_mount_stand_alone: 'true',
      ceiling_mount_id: 'CM-1',
      ceiling_mount_name: 'Ceiling mount',
    };
    const n = normalizeAccessoryMapping(raw);
    expect(n.cameraId).toBe('CAM-1');
    expect(n.qty).toBe(2);
    expect(n.junction.id).toBe('JB-1');
    expect(n.wall.id).toBe('WM-1');
    expect(n.wall.stand_alone).toBe(true);
    expect(n.ceiling.id).toBe('CM-1');
  });

  it('pas de camera_id → null', () => {
    expect(normalizeAccessoryMapping({})).toBeNull();
    expect(normalizeAccessoryMapping({ camera_id: 'false' })).toBeNull();
  });

  it('qty bornée [1, 999]', () => {
    expect(normalizeAccessoryMapping({ camera_id: 'X', qty: 0 }).qty).toBe(1);
    expect(normalizeAccessoryMapping({ camera_id: 'X', qty: 9999 }).qty).toBe(999);
  });

  it('accessoires absents → null', () => {
    const n = normalizeAccessoryMapping({ camera_id: 'X' });
    expect(n.junction).toBeNull();
    expect(n.wall).toBeNull();
    expect(n.ceiling).toBeNull();
    expect(n.pole).toBeNull();
    expect(n.corner).toBeNull();
  });
});
