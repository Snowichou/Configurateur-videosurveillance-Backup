// ============================================================
// Tests utils/format.js — import direct du module ESM
// ============================================================
//
// Premier test "moderne" qui importe le code REAL au lieu d'une
// copie miroir. Sert de preuve de concept pour la migration des
// autres modules à venir.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  safeHtml,
  isFalseLike,
  toBool,
  toStrOrFalse,
  toNum,
  clampInt,
  clampNum,
  clamp,
  slugify,
} from '../utils/format.js';

describe('safeHtml', () => {
  it('échappe les 5 caractères HTML spéciaux', () => {
    expect(safeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(safeHtml('a&b')).toBe('a&amp;b');
    expect(safeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(safeHtml("it's")).toBe('it&#039;s');
  });

  it("gère null, undefined et nombres", () => {
    expect(safeHtml(null)).toBe('');
    expect(safeHtml(undefined)).toBe('');
    expect(safeHtml(42)).toBe('42');
    expect(safeHtml(0)).toBe('0');
  });

  it('ne touche pas aux caractères accentués', () => {
    expect(safeHtml('Caméra à 5 €')).toBe('Caméra à 5 €');
  });
});

describe('isFalseLike', () => {
  it('détecte les valeurs falsy CSV/config', () => {
    expect(isFalseLike(null)).toBe(true);
    expect(isFalseLike(undefined)).toBe(true);
    expect(isFalseLike('')).toBe(true);
    expect(isFalseLike('false')).toBe(true);
    expect(isFalseLike('FALSE')).toBe(true);
    expect(isFalseLike('0')).toBe(true);
    expect(isFalseLike('no')).toBe(true);
    expect(isFalseLike('  No  ')).toBe(true);
  });

  it('renvoie false pour des valeurs réelles', () => {
    expect(isFalseLike('true')).toBe(false);
    expect(isFalseLike('1')).toBe(false);
    expect(isFalseLike('yes')).toBe(false);
    expect(isFalseLike('hello')).toBe(false);
    expect(isFalseLike('  text  ')).toBe(false);
  });
});

describe('toBool', () => {
  it('détecte les vraies valeurs truthy', () => {
    expect(toBool('true')).toBe(true);
    expect(toBool('TRUE')).toBe(true);
    expect(toBool('1')).toBe(true);
    expect(toBool('yes')).toBe(true);
    expect(toBool('y')).toBe(true);
  });

  it('renvoie false pour le reste', () => {
    expect(toBool(null)).toBe(false);
    expect(toBool('')).toBe(false);
    expect(toBool('false')).toBe(false);
    expect(toBool('hello')).toBe(false);
    expect(toBool('0')).toBe(false);
  });
});

describe('toStrOrFalse', () => {
  it('renvoie false pour les falsy', () => {
    expect(toStrOrFalse(null)).toBe(false);
    expect(toStrOrFalse('')).toBe(false);
    expect(toStrOrFalse('false')).toBe(false);
  });

  it('renvoie la chaîne trimée pour les valides', () => {
    expect(toStrOrFalse('  hello  ')).toBe('hello');
    expect(toStrOrFalse('foo')).toBe('foo');
  });
});

describe('toNum', () => {
  it('parse les nombres valides', () => {
    expect(toNum('42')).toBe(42);
    expect(toNum('3.14')).toBeCloseTo(3.14);
    expect(toNum('-5')).toBe(-5);
    expect(toNum('  10  ')).toBe(10);
  });

  it('renvoie null pour les invalides', () => {
    expect(toNum(null)).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum('')).toBeNull();
    expect(toNum('abc')).toBeNull();
    expect(toNum(NaN)).toBeNull();
  });
});

describe('clampInt', () => {
  it('parse et borne entre min et max', () => {
    expect(clampInt(15, 0, 10)).toBe(10);
    expect(clampInt(-5, 0, 10)).toBe(0);
    expect(clampInt('5', 0, 10)).toBe(5);
  });

  it('renvoie min pour NaN', () => {
    expect(clampInt('abc', 1, 100)).toBe(1);
    expect(clampInt(null, 5, 10)).toBe(5);
  });

  it('parse "12.7" comme 12 (parseInt)', () => {
    expect(clampInt('12.7', 0, 100)).toBe(12);
  });
});

describe('clampNum', () => {
  it('parse float et borne', () => {
    expect(clampNum('3.14', 0, 10, 0)).toBeCloseTo(3.14);
    expect(clampNum(15.5, 0, 10, 0)).toBe(10);
    expect(clampNum(-5.5, 0, 10, 0)).toBe(0);
  });

  it('utilise fallback pour NaN', () => {
    expect(clampNum('abc', 0, 100, 42)).toBe(42);
    expect(clampNum(undefined, 0, 100, 7)).toBe(7);
  });
});

describe('clamp (sans coercition)', () => {
  it('borne strictement entre min et max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
  });
});

describe('slugify', () => {
  it('garde les caractères ASCII et accents', () => {
    expect(slugify('École Jules Ferry')).toBe('école_jules_ferry');
  });

  it('remplace les caractères spéciaux par _', () => {
    expect(slugify('Copro Victor Hugo — Parking')).toBe('copro_victor_hugo_parking');
  });

  it('tronque à maxLen', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long, 10)).toHaveLength(10);
  });

  it('renvoie "projet" si tout est filtré', () => {
    expect(slugify('')).toBe('projet');
    expect(slugify(null)).toBe('projet');
    expect(slugify('___')).toBe('projet');
  });

  it('strip underscores en début et fin', () => {
    expect(slugify('_hello_')).toBe('hello');
  });
});
