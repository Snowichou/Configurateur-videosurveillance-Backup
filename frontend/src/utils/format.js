// ============================================================
// utils/format.js — Helpers de formatage purs
// ============================================================
//
// Module ESM extrait de app.js (Phase 1 refactor).
// Fonctions sans dépendances externes — testables isolément.
//
// Ces fonctions sont également exposées sur window pour préserver
// la rétrocompatibilité avec le code legacy de app.js.
// ============================================================

/**
 * Échappe les caractères HTML spéciaux pour prévenir les injections.
 * @param {*} s - Valeur à échapper (convertie en string)
 * @returns {string} Chaîne HTML-safe
 */
export const safeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[m]
  );

/**
 * Détermine si une valeur est "fausse" au sens CSV/config (null, "", "false", "0", "no").
 * @param {*} v
 * @returns {boolean}
 */
export const isFalseLike = (v) => {
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'false' || s === '0' || s === 'no' || s === 'n';
};

/**
 * Parse une valeur en booléen strict ("true"/"1"/"yes"/"y" → true).
 * @param {*} v
 * @returns {boolean}
 */
export const toBool = (v) => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
};

/**
 * Renvoie la chaîne trimée si elle n'est pas falseLike, sinon false.
 * @param {*} v
 * @returns {string|false}
 */
export const toStrOrFalse = (v) => (isFalseLike(v) ? false : String(v).trim());

/**
 * Parse une valeur en nombre fini, sinon null.
 * @param {*} v
 * @returns {number|null}
 */
export const toNum = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse en entier et borne entre min et max. Renvoie min si NaN.
 * @param {*} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};

/**
 * Parse en nombre (float) et borne entre min et max. Utilise fallback si NaN.
 * @param {*} v
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

/**
 * Math.max(min, Math.min(max, n)) sans coercition.
 * @param {number} n
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/**
 * Génère un slug ASCII safe pour les noms de fichiers (PDF, URLs).
 * Garde les accents minuscules pour la lisibilité humaine.
 * @param {string} s
 * @param {number} [maxLen=40]
 * @returns {string}
 */
export const slugify = (s, maxLen = 40) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüç]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen) || 'projet';

// ─── Compat globals (legacy app.js) ─────────────────────────
// app.js référence ces fonctions sans les importer (legacy IIFE).
// On les expose sur window pour préserver le comportement actuel
// pendant la phase de transition.
