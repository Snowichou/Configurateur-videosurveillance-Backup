// ============================================================
// storage/photo-store.js — Stockage local des photos de mesure (IndexedDB)
// ============================================================
//
// Stockage 100 % LOCAL. Les photos (JPEG compressé, cf. capture.js) ne
// quittent jamais l'appareil : aucun envoi serveur. Clé = projectId +
// cameraId, ce qui évite les collisions inter-projets et permet une
// purge par projet.
//
// Robustesse (phase 6) : si IndexedDB est indisponible (mode privé,
// navigateur restreint, quota...), toutes les fonctions échouent en
// douceur (false / null) sans jamais lever — l'app reste fonctionnelle
// avec la distance seule.
//
// Exports :
//   - photoStoreAvailable()                          : boolean
//   - photoKey(projectId, cameraId)                  : string (pur)
//   - savePhoto(projectId, cameraId, blob, meta)     : Promise<boolean>
//   - getPhoto(projectId, cameraId)                  : Promise<record|null>
//   - deletePhoto(projectId, cameraId)               : Promise<boolean>
//   - clearProject(projectId)                        : Promise<boolean>
// ============================================================

const DB_NAME = 'comelit-measure';
const STORE = 'photos';
const DB_VERSION = 1;

/**
 * @returns {boolean} true si l'API IndexedDB est disponible.
 */
export function photoStoreAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB != null;
  } catch {
    return false;
  }
}

/**
 * Construit la clé de stockage (fonction pure, testable).
 * @param {string} projectId
 * @param {string} cameraId
 * @returns {string}
 */
export function photoKey(projectId, cameraId) {
  return `${String(projectId ?? '')}::${String(cameraId ?? '')}`;
}

/** Ouvre (ou crée) la base. Rejette si IndexedDB indisponible. */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!photoStoreAvailable()) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'key' });
        os.createIndex('byProject', 'projectId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('open_failed'));
  });
}

function store(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * Enregistre (ou remplace) la photo d'une caméra.
 * @param {string} projectId
 * @param {string} cameraId
 * @param {Blob} blob - JPEG compressé
 * @param {{distanceM?:number, heightM?:number}} [meta]
 * @returns {Promise<boolean>}
 */
export async function savePhoto(projectId, cameraId, blob, meta = {}) {
  if (!photoStoreAvailable() || !blob) return false;
  try {
    const db = await openDB();
    const rec = {
      key: photoKey(projectId, cameraId),
      projectId: String(projectId ?? ''),
      cameraId: String(cameraId ?? ''),
      blob,
      type: blob.type || 'image/jpeg',
      size: blob.size || 0,
      distanceM: meta.distanceM ?? null,
      heightM: meta.heightM ?? null,
      createdAt: Date.now(),
    };
    await new Promise((res, rej) => {
      const r = store(db, 'readwrite').put(rec);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit l'enregistrement photo (record complet, blob inclus).
 * @returns {Promise<Object|null>}
 */
export async function getPhoto(projectId, cameraId) {
  if (!photoStoreAvailable()) return null;
  try {
    const db = await openDB();
    const rec = await new Promise((res, rej) => {
      const r = store(db, 'readonly').get(photoKey(projectId, cameraId));
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return rec;
  } catch {
    return null;
  }
}

/**
 * Supprime la photo d'une caméra.
 * @returns {Promise<boolean>}
 */
export async function deletePhoto(projectId, cameraId) {
  if (!photoStoreAvailable()) return false;
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const r = store(db, 'readwrite').delete(photoKey(projectId, cameraId));
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Purge toutes les photos d'un projet (via l'index byProject).
 * @returns {Promise<boolean>}
 */
export async function clearProject(projectId) {
  if (!photoStoreAvailable()) return false;
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const os = store(db, 'readwrite');
      const idx = os.index('byProject');
      const range = IDBKeyRange.only(String(projectId ?? ''));
      const cur = idx.openCursor(range);
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          c.delete();
          c.continue();
        } else {
          res();
        }
      };
      cur.onerror = () => rej(cur.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}
