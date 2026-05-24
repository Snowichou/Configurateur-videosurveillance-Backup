// ============================================================
// utils/csv.js — Parser CSV robuste (extrait de app.js Phase 1)
// ============================================================
//
// Gère :
//   - Champs entre guillemets ("a,b,c" reste un seul champ)
//   - Échappement des guillemets doublés ("she said ""hi""")
//   - Sauts de ligne CRLF et LF
//   - BOM UTF-8 (U+FEFF) en début de fichier
//   - Headers dupliqués (name,name,name -> name, name_2, name_3)
//   - Lignes entièrement vides ignorées
//
// Sortie : tableau d'objets {colName: cellValue} avec valeurs trimées.
// ============================================================

/**
 * Parse une chaîne CSV en tableau d'objets {col: val}.
 *
 * @param {string} text - Contenu CSV brut
 * @returns {Array<Object<string, string>>} Lignes parsées (sans header)
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        cur += ch;
      }
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  // 1) Headers : trim + remove BOM UTF-8 (U+FEFF)
  const rawHeaders = rows[0].map((h) =>
    String(h ?? '')
      .trim()
      .replace(/^\uFEFF/, '')
  );

  // 2) Gestion des headers dupliqués : name,name,name -> name, name_2, name_3
  const headers = (() => {
    const counts = new Map();
    return rawHeaders.map((h, idx) => {
      const base = h || `col_${idx + 1}`;
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      return n === 1 ? base : `${base}_${n}`;
    });
  })();

  // 3) Conversion lignes -> objets
  const objs = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = String(cells[c] ?? '').trim();
    }
    objs.push(obj);
  }

  return objs;
}

/**
 * Fetch et parse un CSV depuis une URL.
 *
 * @param {string} url
 * @returns {Promise<Array<Object>>}
 * @throws {Error} Si la requête échoue (status !== 200)
 */
export async function loadCsv(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CSV load failed: ${url} → HTTP ${res.status}`);
  }
  const text = await res.text();
  return parseCsv(text);
}

// ─── Compat global (legacy app.js) ──────────────────────────
if (typeof window !== 'undefined') {
  window.parseCsv = parseCsv;
  window.loadCsv = loadCsv;
  window._parseCsvPure = parseCsv;
  window._loadCsvPure = loadCsv;
}
