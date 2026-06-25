// ============================================================
// Tests storage — Photo store IndexedDB (mesure DORI)
// ============================================================
//
// Utilise fake-indexeddb pour un vrai aller-retour IndexedDB en test.
// Couvre : clé pure, disponibilité, save/get/delete, purge par projet,
// et le repli gracieux quand IndexedDB est indisponible.
// ============================================================

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  photoKey,
  photoStoreAvailable,
  savePhoto,
  getPhoto,
  deletePhoto,
  clearProject,
} from '../storage/photo-store.js';

const jpeg = (n = 16) => new Blob(['x'.repeat(n)], { type: 'image/jpeg' });

describe('photoKey (pur)', () => {
  it('compose projectId::cameraId', () => {
    expect(photoKey('P1', 'B2')).toBe('P1::B2');
  });
  it('gère null/undefined', () => {
    expect(photoKey(null, undefined)).toBe('::');
  });
});

describe('photoStoreAvailable', () => {
  it('true sous fake-indexeddb', () => {
    expect(photoStoreAvailable()).toBe(true);
  });
});

describe('save / get / delete', () => {
  it('aller-retour : sauvegarde puis relecture du blob + méta', async () => {
    const ok = await savePhoto('Pa', 'Ba', jpeg(20), { distanceM: 15, heightM: 2.5 });
    expect(ok).toBe(true);

    const rec = await getPhoto('Pa', 'Ba');
    expect(rec).not.toBeNull();
    expect(rec.projectId).toBe('Pa');
    expect(rec.cameraId).toBe('Ba');
    expect(rec.distanceM).toBe(15);
    expect(rec.heightM).toBe(2.5);
    expect(rec.blob).toBeTruthy(); // blob restitué (copie structured-clone)
    expect(rec.size).toBe(20);
  });

  it('getPhoto inexistant → null', async () => {
    expect(await getPhoto('Pa', 'inconnu')).toBeNull();
  });

  it('savePhoto sans blob → false', async () => {
    expect(await savePhoto('Pa', 'Bx', null)).toBe(false);
  });

  it('deletePhoto supprime l’enregistrement', async () => {
    await savePhoto('Pd', 'Bd', jpeg());
    expect(await getPhoto('Pd', 'Bd')).not.toBeNull();
    expect(await deletePhoto('Pd', 'Bd')).toBe(true);
    expect(await getPhoto('Pd', 'Bd')).toBeNull();
  });
});

describe('clearProject', () => {
  it('purge uniquement le projet ciblé', async () => {
    await savePhoto('PX', 'B1', jpeg());
    await savePhoto('PX', 'B2', jpeg());
    await savePhoto('PY', 'B1', jpeg());

    expect(await clearProject('PX')).toBe(true);
    expect(await getPhoto('PX', 'B1')).toBeNull();
    expect(await getPhoto('PX', 'B2')).toBeNull();
    // L'autre projet est intact.
    expect(await getPhoto('PY', 'B1')).not.toBeNull();
  });
});

describe('repli gracieux si IndexedDB indisponible', () => {
  let saved;
  beforeEach(() => {
    saved = globalThis.indexedDB;
  });

  it('save/get/delete ne lèvent pas et renvoient false/null', async () => {
    globalThis.indexedDB = undefined;
    try {
      expect(photoStoreAvailable()).toBe(false);
      expect(await savePhoto('P', 'B', jpeg())).toBe(false);
      expect(await getPhoto('P', 'B')).toBeNull();
      expect(await deletePhoto('P', 'B')).toBe(false);
      expect(await clearProject('P')).toBe(false);
    } finally {
      globalThis.indexedDB = saved;
    }
  });
});
