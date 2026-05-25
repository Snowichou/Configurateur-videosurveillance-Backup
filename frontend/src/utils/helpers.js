/**
 * utils/helpers.js — Micro-helpers utilitaires purs
 * PH6.3 — extraits de app.js
 *
 * Exports:
 *   sanitizeFilename(name) — nettoie un nom de fichier
 *   dedupByUrl(items)      — déduplique une liste par .url
 */

/**
 * Nettoie un nom de fichier : supprime les caractères spéciaux,
 * normalise les espaces.
 */
export function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[\/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Déduplique une liste d'objets par leur propriété `.url`.
 * Les items sans url ou avec url vide sont ignorés.
 */
export function dedupByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    const u = String(it?.url || "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(it);
  }
  return out;
}

window._sanitizeFilenamePure = sanitizeFilename;
window._dedupByUrlPure = dedupByUrl;
