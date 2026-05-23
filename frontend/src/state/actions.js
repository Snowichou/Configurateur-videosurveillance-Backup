// ============================================================
// state/actions.js — Mutations basiques du MODEL
// ============================================================
//
// Helpers de mutation extraits de app.js (Phase 2 refactor).
//
// Toutes les actions mutent le MODEL EN PLACE (la référence reste
// stable, c'est important car window._MODEL pointe dessus, et le
// reste de l'app garde une closure sur la même référence).
//
// Exports :
//   - uid(prefix)                            : générateur d'ids uniques
//   - createEmptyCameraBlock(useCase, uidFn) : factory bloc caméra
//   - resetModel(model, limits, opts)        : remet le MODEL à neuf
//   - setProjectField(model, key, value)     : setter projet
// ============================================================

import { createInitialModel } from './model.js';

/**
 * Générateur d'identifiants courts non-cryptographiques.
 * Format : `${prefix}_${randomHex}_${timestampHex}`
 *
 * @param {string} [prefix='ID']
 * @returns {string}
 */
export function uid(prefix = 'ID') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * Construit un bloc caméra vierge (étape 1 du wizard interne).
 *
 * @param {string} [useCase=''] - Use case hérité du projet
 * @param {Function} [uidFn=uid] - Générateur d'id (injectable pour tests)
 * @returns {Object}
 */
export function createEmptyCameraBlock(useCase = '', uidFn = uid) {
  return {
    id: uidFn('B'),
    label: '',
    qty: 1,
    quality: 'standard',
    // Wizard interne 4 étapes : 0=Où, 1=Quoi, 2=Comment, 3=Caméra
    currentStep: 0,
    answers: {
      use_case: useCase || '',
      emplacement: 'exterieur',
      // Type d'IA demandé : "" | "next" | "advance"
      ai_type: '',
      objective: '',
      distance_m: '',
      mounting: 'wall',
      // Type spécial forcé : "" | "ptz" | "panoramic_180"
      force_camera_type: '',
    },
    selectedCameraId: null,
    validated: false,
    validatedLineId: null,
    accessories: [],
  };
}

/**
 * Remet le MODEL à neuf en mutant en place (préserve la référence).
 *
 * Conserve par défaut : projectName / projectUseCase / projectNotes /
 * projectTags / ui.mode / ui.demo / ui.favorites. Passe `opts.keepProject:false`
 * pour tout réinitialiser.
 *
 * @param {Object} model    - MODEL à muter
 * @param {Object} [limits] - Limites métier (LIM)
 * @param {Object} [opts]
 * @param {boolean} [opts.withInitialBlock=true] - Ajoute un bloc caméra vide
 * @param {boolean} [opts.keepProject=true]      - Préserve les champs projet
 * @returns {Object} model muté (même référence)
 */
export function resetModel(model, limits, opts = {}) {
  if (!model || typeof model !== 'object') return model;
  const withInitialBlock = opts.withInitialBlock !== false;
  const keepProject = opts.keepProject !== false;

  // Snapshot des champs à préserver
  const preserved = keepProject
    ? {
        projectName: model.projectName,
        projectUseCase: model.projectUseCase,
        projectNotes: model.projectNotes,
        projectTags: model.projectTags,
        uiMode: model.ui?.mode,
        uiDemo: model.ui?.demo,
        uiFavorites: model.ui?.favorites,
      }
    : null;

  // Reconstruit un MODEL initial et copie dans `model` (mutation en place)
  const fresh = createInitialModel(limits);
  // Vider proprement les clés existantes qui ne sont pas dans fresh
  for (const k of Object.keys(model)) {
    if (!(k in fresh)) delete model[k];
  }
  Object.assign(model, fresh);

  if (preserved) {
    if (typeof preserved.projectName === 'string') model.projectName = preserved.projectName;
    if (typeof preserved.projectUseCase === 'string') model.projectUseCase = preserved.projectUseCase;
    if (typeof preserved.projectNotes === 'string') model.projectNotes = preserved.projectNotes;
    if (typeof preserved.projectTags === 'string') model.projectTags = preserved.projectTags;
    if (preserved.uiMode) model.ui.mode = preserved.uiMode;
    if (typeof preserved.uiDemo === 'boolean') model.ui.demo = preserved.uiDemo;
    if (Array.isArray(preserved.uiFavorites)) model.ui.favorites = [...preserved.uiFavorites];
  }

  if (withInitialBlock) {
    model.cameraBlocks = [createEmptyCameraBlock(model.projectUseCase || '')];
  }

  return model;
}

/**
 * Setter typé pour les champs projet.
 * Trim auto, ignore les non-string.
 *
 * @param {Object} model
 * @param {"name"|"useCase"|"notes"|"tags"} key
 * @param {*} value
 * @returns {Object} model
 */
export function setProjectField(model, key, value) {
  if (!model) return model;
  const map = {
    name: 'projectName',
    useCase: 'projectUseCase',
    notes: 'projectNotes',
    tags: 'projectTags',
  };
  const prop = map[key];
  if (!prop) return model;
  model[prop] = String(value ?? '').trim();
  return model;
}

// ─── Compat globals (legacy app.js) ─────────────────────────
if (typeof window !== 'undefined') {
  window._uid = uid;
  window._createEmptyCameraBlockPure = createEmptyCameraBlock;
  window._resetModel = resetModel;
  window._setProjectField = setProjectField;
}
