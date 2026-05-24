/**
 * catalog/media.js — Médias locaux (images + datasheets)
 * PH4.4a — extrait de app.js
 *
 * Exports:
 *   getThumbSrc(family, id)         — URL image locale PNG
 *   getDatasheetSrc(family, ref)    — URL datasheet locale PDF
 *   applyLocalMediaToCatalog(CATALOG) — peuple image_url / datasheet_url du catalogue
 */

const LOCAL_IMG_ROOT = '/data/Images';
const LOCAL_PDF_ROOT = '/data/fiche_tech';
const __thumbCache = new Map();

export function getThumbSrc(family, id) {
  try {
    const fam = String(family || '').trim();
    const ref = String(id || '').trim();
    if (!fam || !ref) return '';

    const key = fam + '::' + ref;
    if (__thumbCache.has(key)) return __thumbCache.get(key);

    const url = LOCAL_IMG_ROOT + '/' + fam + '/' + encodeURIComponent(ref) + '.png';
    __thumbCache.set(key, url);
    return url;
  } catch {
    return '';
  }
}

export function getDatasheetSrc(family, ref) {
  const id = String(ref || '').trim();
  if (!id) return '';
  const fam = String(family || '').toLowerCase().trim();

  let folder = fam;
  if (fam === 'cameras') folder = 'cameras';
  else if (fam === 'nvrs') folder = 'nvrs';
  else if (fam === 'hdds') folder = 'hdds';
  else if (fam === 'switches') folder = 'switches';
  else if (fam === 'accessories') folder = 'accessories';
  else if (fam === 'screens') folder = 'screens';
  else if (fam === 'enclosures') folder = 'enclosures';
  else if (fam === 'signage') folder = 'signage';

  return LOCAL_PDF_ROOT + '/' + folder + '/' + encodeURIComponent(id) + '.pdf';
}

/**
 * Peuple image_url + datasheet_url du CATALOG depuis les assets locaux.
 * Ne PAS écraser si l’URL CSV existe déjà.
 */
export function applyLocalMediaToCatalog(CATALOG) {
  const apply = (familyKey, list) => {
    if (!Array.isArray(list)) return;
    const fam = String(familyKey || '').toLowerCase();
    for (const it of list) {
      const id = String(it?.id || '').trim();
      if (!id) continue;
      if (!it.image_url || it.image_url === 'false') {
        it.image_url = getThumbSrc(fam, id);
      }
      if (!it.datasheet_url || it.datasheet_url === 'false') {
        it.datasheet_url = getDatasheetSrc(fam, id);
      }
    }
  };

  apply('cameras',    CATALOG?.CAMERAS);
  apply('nvrs',       CATALOG?.NVRS);
  apply('hdds',       CATALOG?.HDDS);
  apply('switches',   CATALOG?.SWITCHES);
  apply('accessories',CATALOG?.ACCESSORIES);
  apply('screens',    CATALOG?.SCREENS);
  apply('enclosures', CATALOG?.ENCLOSURES);
  apply('signage',    CATALOG?.SIGNAGE);
}

window._getThumbSrc = getThumbSrc;
window._getDatasheetSrc = getDatasheetSrc;
window._applyLocalMediaToCatalogPure = applyLocalMediaToCatalog;
