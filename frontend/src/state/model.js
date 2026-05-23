// ============================================================
// state/model.js — Factory du MODEL (état projet)
// ============================================================
//
// Le MODEL est l'objet d'état central du configurateur : il contient
// la sélection caméras/NVR/stockage, les compléments (écran, boîtier,
// signalétique), les préférences UI, et le nom/contexte du projet.
//
// Cette factory produit la forme INITIALE du MODEL. Elle est utilisée :
//   1. Au démarrage de l'application (instance globale unique)
//   2. Lors d'un "Réinitialiser" pour repartir d'un état propre
//   3. En tests pour disposer d'un MODEL prévisible
//
// Le MODEL est ensuite muté en place par l'IIFE de app.js (à terme :
// par des reducers purs dans `state/reducers.js` — Phase 2 suite).
// ============================================================

/**
 * Limites par défaut utilisées pour initialiser les valeurs métier.
 * Doit refléter `LIMITS` de `core/constants.js`.
 * @typedef {Object} Limits
 * @property {number} maxRetentionDays
 * @property {number} maxHoursPerDay
 * @property {number} defaultRetentionDays
 * @property {number} defaultFps
 * @property {number} defaultOverheadPct
 * @property {number} defaultReservePortsPct
 */

/**
 * Defaults autonomes — utilisés si aucun objet `limits` n'est passé
 * (par ex. depuis les tests, sans monter `core/constants.js`).
 */
const FALLBACK_LIMITS = Object.freeze({
  defaultRetentionDays: 14,
  maxHoursPerDay: 24,
  defaultFps: 25,
  defaultOverheadPct: 20,
  defaultReservePortsPct: 10,
});

/**
 * Construit un MODEL vierge prêt à être muté par l'application.
 *
 * @param {Limits} [limits=FALLBACK_LIMITS] - Limites métier (LIM)
 * @returns {Object} MODEL initial
 */
export function createInitialModel(limits = FALLBACK_LIMITS) {
  const L = limits || FALLBACK_LIMITS;
  return {
    cameraBlocks: [],
    cameraLines: [],
    accessoryLines: [],

    recording: {
      daysRetention: L.defaultRetentionDays ?? 14,
      hoursPerDay: L.maxHoursPerDay ?? 24,
      fps: L.defaultFps ?? 25,
      codec: 'h265',
      mode: 'continuous',
      overheadPct: L.defaultOverheadPct ?? 20,
      reservePortsPct: L.defaultReservePortsPct ?? 10,
    },

    complements: {
      screen: { enabled: false, sizeInch: 18, qty: 1 },
      enclosure: { enabled: false, qty: 1 },
      signage: { enabled: false, scope: 'Public', qty: 1 },
    },

    ui: {
      activeBlockId: null,
      resultsShown: false,

      // UI prefs (persistées)
      mode: 'simple', // "simple" | "expert"
      demo: false, // true => UI orientée vente (moins "technique")
      onlyFavs: false, // filtre favoris dans propositions
      favorites: [], // [cameraId]
      compare: [], // [cameraId, cameraId] max 2
      previewByBlock: {}, // { [blockId]: cameraId } => carte "pré-sélectionnée"
    },

    projectName: '',
    projectUseCase: '', // Use case global du projet (Résidentiel, Tertiaire, etc.)
    projectNotes: '', // Notes commerciales libres
    projectTags: '', // Tags/étiquettes "client, site" (séparés par virgule)

    stepIndex: 0,
  };
}

// ─── Compat global (legacy app.js) ──────────────────────────
if (typeof window !== 'undefined') {
  window._createInitialModel = createInitialModel;
}
