/************************************
 * Configurateur Vidéosurveillance (Full Frontend)
 * Refactor propre (vanilla JS)
 *
 * ✅ Mode configurateur (pas liste)
 * Étapes :
 * 1) Caméras (blocs → panier)
 * 2) Supports (accessoires par bloc)
 * 3) NVR + Réseau (Switch PoE)
 * 4) Stockage
 *
 * Données via CSV (/data) :
 * cameras.csv / nvrs.csv / hdds.csv / switches.csv / accessories.csv
 *
 * ✅ FIXES / AJOUTS CONSERVÉS (hors “fix NVR” retiré à ta demande)
 * - accessories.csv = MAPPING camera_id -> accessoires compatibles
 * - normalizeAccessoryMapping aligné avec TON header exact :
 *   camera_id,junction_box_id,junction_box_name,wall_mount_id,wall_mount_name,wall_mount_stand_alone,
 *   ceiling_mount_id,ceiling_mount_name,ceiling_mount_stand_alone,qty,
 *   image_url_junction_box,datasheet_url_junction_box,image_url_wall_mount,datasheet_url_wall_mount,
 *   image_url_ceiling_mount,datasheet_url_ceiling_mount
 * - Ajout normalizeMappedAccessory (robuste false-like)
 * - suggestAccessoriesForBlock utilise qty mapping + qty bloc correctement
 * - Dé-doublonnage sécurisé type+id
 * - Robustesse : si mapping manquant => accessoires vide (message UI déjà prévu)
 * - Junction box proposée SYSTÉMATIQUEMENT (si présente dans le mapping)
 * - parseCsv gère les headers dupliqués (name,name,name -> name, name_2, name_3)
 *   => évite l’écrasement d’objets et corrige les champs qui “disparaissent”
 ************************************/

// ── PH6.5: imports ESM directs (remplace shims window._xxx) ──
import { uid, createEmptyCameraBlock as _createEmptyCameraBlock, resetModel } from './state/actions.js';
import { createInitialModel } from './state/model.js';
import { scoreCameraForBlock as _scoreCameraForBlock, interpretScoreForBlock as _interpretScoreForBlock } from './engine/camera-score.js';
import { recommendCameraForAnswers as _recommendCameraForAnswers } from './engine/camera-reco.js';
import { createLabelsHelpers } from './ui/labels.js';
import { createComplementsHandlers } from './engine/complements.js';
import { kpiConfigSnapshotPure } from './engine/kpi.js';
import { createKpiSnapshot } from './engine/kpi-tracker.js';
import { sanityPure } from './engine/sanity.js';
import { createBlockLifecycleHandlers } from './engine/block-lifecycle.js';
import { computeTotals as _computeTotals, computeCriticalProjectScore as _computeCriticalProjectScore } from './engine/totals.js';
import { pickNvr as _pickNvr } from './engine/pick-nvr.js';
import { planPoESwitches as _planPoESwitches } from './engine/poe.js';
import { mbpsToTB, pickDisks as _pickDisks } from './engine/storage-calc.js';
import { computeProjectPure } from './engine/project.js';
import { createRecoBlockHelpers } from './engine/reco-block.js';
import { createPersistenceHandlers } from './engine/persistence.js';
import { getThumbSrc, applyLocalMediaToCatalog as _applyLocalMediaToCatalog } from './catalog/media.js';
import { normalizeCamera, normalizeNvr, normalizeHdd, normalizeSwitch,
         normalizeScreen, normalizeEnclosure, normalizeSignageRow,
         normalizeAccessoryMapping } from './catalog/normalize.js';
import { loadCsv } from './utils/csv.js';
import { sanitizeFilename, dedupByUrl } from './utils/helpers.js';
import { generateQRDataUrlPure, generateShareUrlPure } from './utils/share.js';
import { showToastPure } from './ui/toast.js';
import { validateStepPure, showStepValidationErrorsPure } from './engine/validate-step.js';
import { renderFinalSummaryPure } from './render/summary-final.js';
import { buildPdfHtmlPure } from './render/pdf.js';
import { createRenderPipeline } from './render/pipeline.js';
import { renderCameraPickCard } from './render/camera-card.js';
import { renderStepCameras as _renderStepCameras } from './render/cameras.js';
import { renderStepProject as _renderStepProject } from './render/projet.js';
import { renderStepAccessories as _renderStepAccessories } from './render/accessories.js';
import { renderStepNvrNetwork as _renderStepNvrNetwork } from './render/nvr.js';
import { renderStepStorage as _renderStepStorage } from './render/storage.js';
import { renderStepComplements as _renderStepComplements } from './render/options.js';
import { renderStepSummary as _renderStepSummary } from './render/summary.js';
import { bindSummaryButtonsPure } from './handlers/summary.js';
import { createQuoteHandlers } from './handlers/quote.js';
import { createStepsHandlers } from './handlers/steps.js';
import { initPure } from './handlers/init.js';
import { createAdminHandlers } from './handlers/admin.js';
import { buildPdfBlobProFromProjectPure } from './render/pdf-blob.js';
import { collectDatasheetUrlsFromProjectPure } from './render/datasheet-urls.js';
import { exportProjectPdfWithLocalDatasheetsZipPure } from './render/pdf-export.js';
import { showPdfPreviewPure } from './render/pdf-preview.js';
import { exportProjectPdfProPure } from './render/pdf-pro.js';
import { testPdfGenerationPure, ensurePdfPackButtonPure } from './render/pdf-test.js';
// ─────────────────────────────────────────────────────────────


  // ==========================================================
  // GLOBALS (doivent exister AVANT toute utilisation)
  // ==========================================================
  let LAST_PROJECT = null;
  let _renderProjectCache = null;
  // Invalide le cache projet — à appeler à chaque mutation du MODEL
    function invalidateProjectCache() {
      _renderProjectCache = null;
      LAST_PROJECT = null;
    }


  window.addEventListener("error", (e) => {
    console.error("JS Error:", e.error || e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise:", e.reason);
  });

    /* =========================================================
    KPI SAFETY SHIM (anti-crash)
    À placer tout en haut du fichier app.js (après "use strict" si présent)
    ========================================================= */
  (() => {
    try {
      const k = (window.KPI = window.KPI || {});
      // Normaliser sendNowait si manquant
      if (typeof k.sendNowait !== "function" && typeof k.send === "function") {
        k.sendNowait = k.send.bind(k);
      }
      // Corriger la typo mortelle : sendNowaitNowait
      if (typeof k.sendNowaitNowait !== "function" && typeof k.sendNowait === "function") {
        k.sendNowaitNowait = k.sendNowait.bind(k);
      }
      // Si rien n'existe, on stub en no-op pour ne jamais casser l'app
      if (typeof k.sendNowait !== "function") k.sendNowait = () => {};
      if (typeof k.send !== "function") k.send = () => {};
    } catch {
      // no-op
    }
  })();


  // ==========================================================
  // 0) HELPERS
  // ==========================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));


  ;

  ;

  ;

    const toNum = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const clampInt = (v, min, max) => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  };

  ;

  // ==========================================================
// BRANDING COMELIT (PDF)
// ==========================================================

// Essaie plusieurs noms possibles (tu ajusteras si besoin)

  // ✅ Phase 2 — extrait dans src/state/actions.js

  const sum = (arr, fn) => {
    let t = 0;
    for (const x of arr) t += fn(x);
    return t;
  };

  const normalizeEmplacement = window.normalizeEmplacement;

  const objectiveToDoriKey = window.objectiveToDoriKey;
  
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  const getMpFromCam = window.getMpFromCam;


  const getIrFromCam = window.getIrFromCam;


  const getDoriForObjective = window.getDoriForObjective;


// ==========================================================
// Score global projet (pondéré par quantité)


// ==========================================================
// AXE 1 — Lecture “pastilles” (strict)

// ==========================================================
// Adaptateur score -> niveaux stricts (ok/warn/bad)


// ==========================================================
// Comptage des niveaux de risque (AXE 1)


  /**
   * Retourne { score, parts[], ratio, dori, required }
   */
  function scoreCameraForBlock(block, cam) {
    // ✅ Phase 2 — logique extraite dans src/engine/camera-score.js
    return _scoreCameraForBlock(block, cam, {
      getDoriForObjective,
      normalizeEmplacement,
      getMpFromCam,
      getIrFromCam,
      getCameraProfile,
      clamp,
    });
  }


/**
 * Interprétation score → 3 niveaux + motif principal + phrase
 * Hard rule (A):
 * - Identification : ratio < 0.85 => rouge
 * - Dissuasion / Détection : ratio < 0.80 => rouge
 */
/**
 * Interprétation "métier" du score (3 niveaux) + hard rule DORI
 * - OK / LIMITE / INADAPTÉ
 * - Seuils plus stricts (C) :
 *   OK >= 80
 *   LIMITE 60..79
 *   INADAPTÉ < 60
 * - Hard rule (A) sur la marge DORI :
 *   Identification : ratio < 0.85 => INADAPTÉ
 *   Dissuasion/Détection : ratio < 0.80 => INADAPTÉ
 */
function interpretScoreForBlock(block, cam) {
  // ✅ Phase 2 — logique extraite dans src/engine/camera-score.js
  return _interpretScoreForBlock(block, cam, {
    getDoriForObjective,
    normalizeEmplacement,
    getMpFromCam,
    getIrFromCam,
    getCameraProfile,
    clamp,
    objectiveLabel,
    T,
  });
}




    // ==========================================================
  // 0B) CSV PARSER (no deps)
  // ==========================================================

// ==========================================================
// 0) CONSTANTES CENTRALISÉES
// ==========================================================

// 1) Couleurs d'abord (pour pouvoir les réutiliser partout sans dépendance circulaire)
const COLORS = Object.freeze({
  green:    "#00BC70",
  blue:     "#1C1F2A",
  danger:   "#DC2626",
  warn:     "#F59E0B",
  muted:    "#6B7280",

  // Fonds "tintés" (lisibles)
  okBg:     "rgba(0,188,112,.12)",
  warnBg:   "rgba(245,158,11,.12)",
  dangerBg: "rgba(220,38,38,.10)",

  // Bonus utiles
  okBorder:     "rgba(0,188,112,.35)",
  warnBorder:   "rgba(245,158,11,.35)",
  dangerBorder: "rgba(220,38,38,.35)",
});

// 2) Ensuite CONFIG (peut référencer COLORS sans problème)
const CONFIG = Object.freeze({
  colors: COLORS,

  // Seuils légaux et métier
  limits: {
    maxRetentionDays: 30,
    maxHoursPerDay: 24,
    maxFps: 30,
    defaultFps: 25,
    defaultRetentionDays: 14,
    defaultOverheadPct: 20,
    defaultReservePortsPct: 10,
    maxProjectNameLength: 80,
    maxBlockLabelLength: 60,
    maxQty: 999,
    maxScreenQty: 20,
    maxEnclosureQty: 10,
    maxSignageQty: 20,
    minPoeCamerasForSwitch: 16,
    shareUrlMaxChars: 4000,
    qrMaxChars: 4000,
  },

  // Codecs disponibles
  codecs: ["h265", "h264"],
  fpsOptions: [10, 12, 15, 20, 25],
  screenSizes: [18, 22, 27, 32, 43, 55],

  // Scoring
  scoring: {
    levels: {
      ok:   { icon: "✅", label: T("cam_recommended"), color: COLORS.green,  bg: COLORS.okBg },
      warn: { icon: "⚠️", label: T("cam_acceptable"),  color: COLORS.warn,   bg: COLORS.warnBg },
      bad:  { icon: "❌", label: T("cam_not_adapted"),  color: COLORS.danger, bg: COLORS.dangerBg },
    }
  },

  // Chemins médias locaux
  paths: {
    imgRoot: "/data/Images",
    pdfRoot: "/data/fiche_tech",
    dataDir: "/data",
  },
});

// Raccourcis
const CLR = CONFIG.colors;
const LIM = CONFIG.limits;

// ==========================================================
  // 1) DATA (catalog)
  // ==========================================================
  const CATALOG = {
  CAMERAS: [],
  NVRS: [],
  HDDS: [],
  SWITCHES: [],
  SCREENS: [],        // ✅ ajouté
  ENCLOSURES: [],     // ✅ ajouté
  SIGNAGE: [],        // ✅ panneaux de signalisation
  ACCESSORIES_MAP: new Map(), // key = camera_id, value = mapping row
  };
  window._CATALOG = CATALOG;
// createLabelsHelpers doit être appelé APRÈS const CATALOG (anti-TDZ)
const {
  objectiveLabel,
  accessoryTypeLabel,
  translateUseCase,
  getAllUseCases,
  getCameraProfile,
} = createLabelsHelpers({
  T,
  CATALOG,
});
  // ==========================================================
  // 2) MODEL (state) — factory extraite dans src/state/model.js (Phase 2)
  // ==========================================================
  const MODEL = createInitialModel(LIM);
  window._MODEL = MODEL;

const KPI = Object.assign({}, window.KPI, {
  snapshot: createKpiSnapshot({
    get MODEL() { return MODEL; },
    getCameraById: (...a) => getCameraById(...a),
  }),
});

  const STEPS = [
    { id: "project", get title(){ return T("step_project"); }, badge: "1/7", get help(){ return T("step_project_help"); } },
    { id: "cameras", get title(){ return T("step_cameras"); }, badge: "2/7", get help(){ return T("step_cameras_help"); } },
    { id: "mounts", get title(){ return T("step_mounts"); }, badge: "3/7", get help(){ return T("step_mounts_help"); } },
    { id: "storage", get title(){ return T("step_storage"); }, badge: "4/7", get help(){ return T("step_storage_help"); } },
    { id: "nvr_network", get title(){ return T("step_nvr"); }, badge: "5/7", get help(){ return T("step_nvr_help"); } },
    { id: "complements", get title(){ return T("step_options"); }, badge: "6/7", get help(){ return T("step_options_help"); } },
    { id: "summary", get title(){ return T("step_summary"); }, badge: "7/7", get help(){ return T("step_summary_help"); } },
  ];

// ✅ Expose STEPS pour le récap flottant
window._STEPS = STEPS;

// ==========================================================
// COMPLÉMENTS (écran, boîtier, signalétique) — engine/complements.js
// ==========================================================
/* eslint-disable no-unused-vars */
const {
  pickScreenBySize, isScreenInsideCompatible, pickBestEnclosure,
  getSignages, pickSignageByScope, getSelectedOrRecommendedSign,
  recommendScreenForProject, recommendEnclosureForNvr,
  getSelectedOrRecommendedScreen, recommendEnclosureForProject,
  getSelectedOrRecommendedEnclosure,
} = createComplementsHandlers({
  get MODEL() { return MODEL; },
  get CATALOG() { return CATALOG; },
});
/* eslint-enable no-unused-vars */

function kpiConfigSnapshot(proj) {
  return kpiConfigSnapshotPure(proj, {
    MODEL,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedSign,
  });
}


// ==========================================================
// 3) DOM CACHE (robuste)
// ==========================================================
const DOM = {
  stepsEl: $("#steps"),
  btnCompute: $("#btnCompute"),
  btnReset: $("#btnReset"),
  btnDemo: $("#btnDemo"),

  progressBar: $("#progressBar"),
  progressText: $("#progressText"),

  resultsEmpty: $("#resultsEmpty"),
  results: $("#results"),
  primaryRecoEl: $("#primaryReco"),
  alertsEl: $("#alerts"),

  dataStatusEl: $("#dataStatus"),

  btnExportPdf: $("#btnExportPdf"),
  btnExportPdfPack: $("#btnExportPdfPack"),
};

  // ==========================================================
  // 4) NORMALIZATION
  // ==========================================================

// i18n: Adapt datasheet URL locale (/fr_FR/ or /fr-fr/ → /xx_XX/ or /xx-xx/)
function localizedDatasheetUrl(url) {
  const lang = (typeof _currentLang !== "undefined") ? _currentLang : "fr";
  return window.localizedDatasheetUrl(url, lang);
}


// ==========================================================
  // 4A) SIGNAGE (panneaux de signalisation)
  // ==========================================================
  // CSV attendu (tes colonnes):
  // id,name,material,fixing,Dimension,Prive_Public,image_url,datasheet_url

  // ==========================================================
  // 4B) ACCESSORIES MAPPING (✅ aligné sur TON CSV)
  // ==========================================================
    /**
   * ✅ Mapping accessoires par caméra (TON FORMAT)
   * camera_id,junction_box_id,junction_box_name,wall_mount_id,wall_mount_name,wall_mount_stand_alone,
   * ceiling_mount_id,ceiling_mount_name,ceiling_mount_stand_alone,qty,
   * image_url_junction_box,datasheet_url_junction_box,image_url_wall_mount,datasheet_url_wall_mount,
   * image_url_ceiling_mount,datasheet_url_ceiling_mount
   */

// ==========================================================
  // 5) LOOKUPS
  // ==========================================================
  const getCameraById = (id) => CATALOG.CAMERAS.find((c) => c.id === id) || null;
  window._getCameraById = getCameraById;

  

  // i18n: traduire les noms de use cases du CSV
  
window._getCameraById = getCameraById;
  // ==========================================================
  // 6) ENGINE - RECO CAMERA (V3 — profils métier + pool élargi)
  // ==========================================================

  


    function recommendCameraForAnswers(ans) {
    // ✅ Phase 2 — logique extraite dans src/engine/camera-reco.js
    return _recommendCameraForAnswers(ans, {
      normalizeEmplacement,
      toNum,
      objectiveToDoriKey,
      getCameraProfile,
      cameras: CATALOG.CAMERAS,
      T,
    });
  }


  // ==========================================================
  // 7) ENGINE - BLOCS + ACCESSOIRES
  // ==========================================================
  // ✅ Phase 2 — extrait dans src/state/actions.js
  function createEmptyCameraBlock() {
    return _createEmptyCameraBlock(MODEL.projectUseCase || '');
  }

// ==========================================================
// UI PREFS (localStorage) + mode démo
// ==========================================================

function applyDemoClass() {
  document.body.classList.toggle("demoMode", !!MODEL?.ui?.demo);
}


// ==========================================================
// 8) ENGINE - BLOCKS SANITY + VALIDATION
// ==========================================================
function sanity() {
  return sanityPure({
    MODEL, createEmptyCameraBlock, applyDemoClass,
  });
}

  // ==========================================================
// 8) ENGINE - BLOCKS LIFECYCLE — engine/block-lifecycle.js
// ==========================================================
/* eslint-disable no-unused-vars */
const {
  rebuildAccessoryLinesFromBlocks, unvalidateBlock, invalidateIfNeeded,
  suggestAccessoriesForBlock, suggestAccessories, validateBlock,
} = createBlockLifecycleHandlers({
  get MODEL() { return MODEL; },
  get CATALOG() { return CATALOG; },
  uid,
  clampInt,
  getCameraById,
  scoreCameraForBlock,
  KPI,
  invalidateProjectCache,
});
/* eslint-enable no-unused-vars */

  // ==========================================================
  // 8) ENGINE - PROJET (NVR / SWITCH / HDD)
  // ==========================================================
  function getTotalCameras() {
    return sum(MODEL.cameraLines, (l) => (l.qty || 0));
  }


  /**
   * AXE 1 — Score solution critique
   * Règle : le score le plus faible parmi les blocs validés
   */
  function computeCriticalProjectScore() {
    // ✅ Phase 2 — logique extraite dans src/engine/totals.js
    return _computeCriticalProjectScore(MODEL.cameraBlocks);
  }


  function computeTotals() {
    // ✅ Phase 2 — logique extraite dans src/engine/totals.js
    return _computeTotals(MODEL.cameraLines, MODEL.recording, { getCameraById });
  }

  function pickNvr(totalCameras, totalInMbps, requiredTB) {
    // ✅ Phase 2 — logique extraite dans src/engine/pick-nvr.js
    return _pickNvr(totalCameras, totalInMbps, requiredTB, {
      cameraLines: MODEL.cameraLines,
      getCameraById,
      catalogNvrs: CATALOG.NVRS,
      catalogHdds: CATALOG.HDDS,
      T,
    });
  }

  function planPoESwitches(totalCameras, reservePct = 10, nvr = null) {
    // ✅ Phase 2 — logique extraite dans src/engine/poe.js
    return _planPoESwitches(totalCameras, reservePct, nvr, CATALOG.SWITCHES);
  }


  function pickDisks(requiredTB, nvr) {
    return _pickDisks(requiredTB, nvr, CATALOG.HDDS);
  }


 // ✅ Phase 2 -- calcul projet extrait dans src/engine/project.js
  function computeProject() {
    return computeProjectPure({
      MODEL,
      CATALOG,
      T,
      KPI,
      clampNum,
      computeTotals,
      getCameraById,
      getTotalCameras,
      mbpsToTB,
      pickDisks,
      pickNvr,
      planPoESwitches,
    });
  }


// petite util locale safe (si tu n’en as pas déjà)
function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}


    // ==========================================================
  // PROJECT CACHE + NAV GUARDS (fixes manquants)
  // ==========================================================

  function getProjectCached() {
    if (_renderProjectCache) return _renderProjectCache;
    try {
      _renderProjectCache = computeProject();
    } catch (e) {
      console.error("[getProjectCached] computeProject failed:", e.message);
      _renderProjectCache = null;
      return null;
    }
    return _renderProjectCache;
  }


  // ==========================================================

  function renderFinalSummary(proj) {
  // ✅ Phase 2 — PH2.22 : rendu récapitulatif final extrait dans render/summary-final.js
  return renderFinalSummaryPure(proj, {
    T,
    safeHtml,
    getThumbSrc,
    MODEL,
    getCameraById,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedSign,
    computeCriticalProjectScore,
  });
}


// ==========================================================
// THUMBS / IMAGES (LOCAL DATA ONLY) — logique dans catalog/media.js
// ==========================================================

  function buildPdfHtml(proj) {
    // ✅ Phase 2 — génération HTML PDF extraite dans src/render/pdf.js
    return buildPdfHtmlPure(proj, {
      T,
      currentLang: _currentLang,
      computeCriticalProjectScore,
      generateQRDataUrl,
      generateShareUrl,
      getCameraById,
      getSelectedOrRecommendedEnclosure,
      getSelectedOrRecommendedScreen,
      getSelectedOrRecommendedSign,
      getThumbSrc,
      interpretScoreForBlock,
      safeHtml,
      CATALOG,
      MODEL,
    });
  }

/* eslint-disable no-unused-vars */
const {
  syncResultsUI, updateNavButtons, updateProgress, render, _renderImmediate,
} = createRenderPipeline({
  get MODEL() { return MODEL; },
  get STEPS() { return STEPS; },
  get DOM() { return DOM; },
  T,
  validateStep,
  renderStepProject,
  renderStepCameras,
  renderStepMounts: typeof renderStepAccessories !== 'undefined' ? renderStepAccessories : undefined,
  renderStepNvrNetwork,
  renderStepStorage,
  renderStepComplements,
  renderStepSummary,
  bindSummaryButtons,
  safeHtml,
});
/* eslint-enable no-unused-vars */


// updateNavButtons() via createRenderPipeline


  // ==========================================================
  // 10) UI - STEPS RENDER
  // ==========================================================
  // updateProgress() via createRenderPipeline


  const { canRecommendBlock, buildRecoForBlock } = createRecoBlockHelpers({
  get MODEL() { return MODEL; },
  toNum,
  recommendCameraForAnswers,
});


function camPickCardHTML(blk, cam) {
  // ✅ Phase 2 — composition HTML extraite dans src/render/camera-card.js
  return renderCameraPickCard(blk, cam, {
    interpretScoreForBlock,
    T,
    CLR,
    safeHtml,
    localizedDatasheetUrl,
    compare: MODEL.ui.compare,
  });
}

  function renderStepCameras() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/cameras.js
    if (!Array.isArray(MODEL.cameraBlocks) || !MODEL.cameraBlocks.length) {
      MODEL.cameraBlocks = [createEmptyCameraBlock()];
    }
    if (!MODEL.ui.activeBlockId) MODEL.ui.activeBlockId = MODEL.cameraBlocks[0].id;
    const activeBlock =
      MODEL.cameraBlocks.find((b) => b.id === MODEL.ui.activeBlockId) || MODEL.cameraBlocks[0];
    MODEL.ui.activeBlockId = activeBlock.id;
    return _renderStepCameras({
      cameraBlocks: MODEL.cameraBlocks,
      activeBlockId: MODEL.ui.activeBlockId,
      ui: {
        favorites: MODEL.ui.favorites,
        mode: MODEL.ui.mode,
        onlyFavs: MODEL.ui.onlyFavs,
        compare: MODEL.ui.compare,
      },
      T,
      safeHtml,
      normalizeEmplacement,
      objectiveLabel,
      canRecommendBlock,
      buildRecoForBlock,
      interpretScoreForBlock,
      getCameraById,
      getMpFromCam,
      getIrFromCam,
      camPickCardHTML,
    });
  }

  function renderStepProject() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/projet.js
    const savedCfg = typeof loadConfigFromLocalStorage === "function" ? loadConfigFromLocalStorage() : null;
    let saveCardHtml = "";
    if (savedCfg) {
      const svN = safeHtml(savedCfg.projectName || "Sans nom");
      const svD = savedCfg.savedAt ? new Date(savedCfg.savedAt).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
      const svC = (savedCfg.cameraLines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
      const svB = (savedCfg.cameraBlocks || []).filter(b => b.validated).length;
      saveCardHtml = `<div class="recoCard" style="padding:14px;border:1.5px solid rgba(0,188,112,.3);background:rgba(0,188,112,.03);margin-bottom:10px">`
        + `<div class="recoName">💾 ${T("proj_save_available")}</div>`
        + `<div class="muted" style="margin-top:4px"><strong>${svN}</strong><br>`
        + (svD ? svD + '<br>' : '')
        + svB + ' bloc(s) · ' + svC + ' caméra(s)</div>'
        + `<div style="display:flex;gap:8px;margin-top:10px">`
        + `<button class="btn primary" data-action="restoreSave" type="button" style="flex:1">📂 ${T("proj_save_load")}</button>`
        + `<button class="btnGhost" data-action="deleteSave" type="button">🗑️</button>`
        + '</div></div>';
    }
    let cloudCardHtml = "";
    if (window._SSO_USER && window._SSO_USER.oid) {
      const isAzure = !!window._SSO_USER.sso;
      const userLabel = isAzure
        ? safeHtml(window._SSO_USER.email || window._SSO_USER.name || "utilisateur")
        : "mode local (sans Azure)";
      const desc = isAzure
        ? `Connecté en tant que <strong>${userLabel}</strong>. Vos projets sont liés à votre compte Azure et accessibles depuis n'importe quel appareil.`
        : `Vous êtes en <strong>${userLabel}</strong>. Les projets sont stockés sur le serveur et partagés entre tous les utilisateurs locaux. Configurez Azure AD pour avoir un espace par utilisateur.`;
      cloudCardHtml = `<div class="recoCard" style="padding:14px;border:1.5px solid rgba(28,31,42,.15);background:linear-gradient(180deg,#FAFEFC 0%,#fff 100%);margin-bottom:10px">`
        + `<div class="recoName">${isAzure ? "☁️" : "🗄️"} Mes projets ${isAzure ? "cloud" : "serveur"}</div>`
        + `<div class="muted" style="margin-top:4px">${desc}</div>`
        + `<div style="margin-top:10px">`
        + `<button class="btn primary" data-action="openCloudProjects" type="button" style="width:100%">📂 Voir mes projets ${isAzure ? "cloud" : "serveur"}</button>`
        + `</div></div>`;
    }
    return _renderStepProject({
      model: MODEL,
      T, safeHtml,
      csvUseCases: getAllUseCases(),
      limits: LIM,
      // projectTipHtml / useCaseDescriptionHtml : optionnels, valeur par défaut dans render/projet.js
      translateUseCase,
      saveCardHtml: cloudCardHtml + saveCardHtml,
    });
  }

  function renderStepAccessories() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/accessories.js
    //    Le caller enrichit chaque bloc validé avec sa caméra résolue.
    const validatedBlocks = (MODEL.cameraBlocks || []).filter((b) => b.validated);
    const blocks = validatedBlocks.map((blk) => {
      const camLine = (MODEL.cameraLines || []).find((cl) => cl.fromBlockId === blk.id);
      const camera = camLine ? getCameraById(camLine.cameraId) : null;
      return { ...blk, camera };
    });
    return _renderStepAccessories({
      blocks,
      T,
      safeHtml,
      normalizeEmplacement,
      accessoryTypeLabel,
      localizedDatasheetUrl,
    });
  }

  function renderStepNvrNetwork() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/nvr.js
    return _renderStepNvrNetwork({
      proj: getProjectCached(),
      isManual: !!MODEL.overrideNvrId,
      T, safeHtml,
      localizedDatasheetUrl,
    });
  }

  function renderStepStorage() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/storage.js
    return _renderStepStorage({
      model: MODEL,
      proj: getProjectCached(),
      T, safeHtml,
      fpsOptions: CONFIG.fpsOptions,
      storageTipHtml,
      renderStorageBarSvg,
    });
  }

  function renderStepComplements() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/options.js
    const proj = getProjectCached();
    const scrEnabled = !!MODEL.complements.screen.enabled;
    const scrSel = scrEnabled && typeof getSelectedOrRecommendedScreen === "function"
      ? getSelectedOrRecommendedScreen(proj)?.selected : null;
    const encEnabled = !!MODEL.complements.enclosure.enabled;
    const screenForEnc = scrEnabled
      ? (typeof pickScreenBySize === "function" ? pickScreenBySize(MODEL.complements.screen.sizeInch) : scrSel)
      : null;
    const encResult = encEnabled && typeof pickBestEnclosure === "function"
      ? pickBestEnclosure(proj, screenForEnc) : null;
    const encSel = encResult?.enclosure
      || (encEnabled && typeof getSelectedOrRecommendedEnclosure === "function"
        ? getSelectedOrRecommendedEnclosure(proj)?.selected : null);
    const screenInsideOk = encResult?.screenInsideOk || false;
    const signEnabled = !!MODEL.complements.signage?.enabled;
    const signSel = signEnabled && typeof getSelectedOrRecommendedSign === "function"
      ? getSelectedOrRecommendedSign()?.sign : null;
    return _renderStepComplements({
      proj,
      selections: {
        screen: { enabled: scrEnabled, selected: scrSel, sizeInch: MODEL.complements.screen.sizeInch, qty: MODEL.complements.screen.qty },
        enclosure: { enabled: encEnabled, selected: encSel, qty: MODEL.complements.enclosure.qty, screenInsideOk, screenSizeInch: Number(MODEL.complements.screen.sizeInch) || 0 },
        signage: { enabled: signEnabled, selected: signSel, scope: MODEL.complements.signage?.scope, qty: MODEL.complements.signage?.qty },
      },
      T, safeHtml,
      screenSizes: CONFIG.screenSizes,
      optionTipHtml,
    });
  }

function renderStepSummary() {
  // ✅ Phase 2 — composition HTML extraite dans src/render/summary.js
  const proj = LAST_PROJECT;
  return _renderStepSummary({
    proj,
    finalSummaryHtml: proj ? renderFinalSummary(proj) : '',
    T,
  });
}

  // ✅ Compat: ancien nom utilisé par render()
if (typeof renderStepMounts !== "function" && typeof renderStepAccessories === "function") {
  window.renderStepMounts = renderStepAccessories;
}
function bindSummaryButtons() {
  return bindSummaryButtonsPure({
    MODEL, STEPS, T,
    syncResultsUI, render,
    exportProjectPdfPro, showPdfPreview, exportProjectPdfPackPro,
    saveConfigToLocalStorage, shareConfigUrl, requestQuote, sendToDistributor,
  });
}


// ==========================================================
// SAUVEGARDE, PARTAGE & TRANSITION COMMERCIALE — engine/persistence.js
// ==========================================================
const LOG = console; // logger (warn/error) — console par défaut
const SAVE_KEY = 'comelit_cfg_save'; // clé localStorage (= persistence.js interne)
const {
  snapshotForSave, restoreFromSnapshot,
  saveConfigToLocalStorage, loadConfigFromLocalStorage, shareConfigUrl,
} = createPersistenceHandlers({
  get MODEL() { return MODEL; },
  LOG,
  showToast,
  T,
  generateShareUrl: () => generateShareUrl(),
  invalidateProjectCache,
});

const { requestQuote, sendToDistributor } = createQuoteHandlers({
  get MODEL() { return MODEL; },
  getLastProject: () => LAST_PROJECT,
  getCameraById,
  T,
  showToast,
  generateShareUrl: () => generateShareUrl(),
});

function showToast(message, type) {
  return showToastPure(message, type, CLR);
}

(function autoRestoreFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cfg = params.get("cfg");
    if (!cfg) return;
    const json = decodeURIComponent(escape(atob(cfg)));
    const light = JSON.parse(json);
    if (light.bl) {
      const snap = {
        projectName: light.pn || "", projectUseCase: light.uc || "",
        cameraBlocks: (light.bl || []).map(b => ({ id: b.id, label: b.lb, validated: b.v, selectedCameraId: b.sc, qty: b.q, answers: b.a || {} })),
        cameraLines: (light.cl || []).map(l => ({ cameraId: l.ci, fromBlockId: l.fb, qty: l.q })),
      };
      const waitAndRestore = () => {
        if (typeof MODEL !== "undefined" && typeof render === "function") {
          restoreFromSnapshot(snap); render();
          showToast("🔗 Configuration restaurée depuis le lien !", "ok");
          const clean = new URL(window.location.href); clean.searchParams.delete("cfg");
          window.history.replaceState({}, "", clean.toString());
        } else setTimeout(waitAndRestore, 200);
      };
      setTimeout(waitAndRestore, 500);
    }
  } catch (e) { LOG.warn("[Share] Auto-restore failed:", e); }
})();

  // ==========================================================
  // MAIN RENDER (manquait → causait "render is not defined")
  // ==========================================================
// Debounce render pour éviter les re-renders multiples rapides
let _renderRAF = null;
// render() + _renderImmediate() via createRenderPipeline


// ==========================================================

// ==========================================================
// QR CODE — Utilise qrcode.js (CDN) pour générer un QR data URL
// ==========================================================
function generateQRDataUrl(text, size = 150) {
  // ✅ Phase 3 — PH3.4 : extraite dans utils/share.js
  return generateQRDataUrlPure(text, size);
}


// ==========================================================
// SHARE URL — Génère l'URL de partage pour le QR code
// ==========================================================
function generateShareUrl() {
  // ✅ Phase 3 — PH3.4 : extraite dans utils/share.js
  return generateShareUrlPure({ snapshotForSave, MODEL });
}


// ==========================================================
// APERÇU PDF — Preview HTML dans une modale
// ==========================================================
function showPdfPreview() {
  // ✅ Phase 2 — PH2.25 : extraite dans render/pdf-preview.js
  return showPdfPreviewPure({
    T,
    getLastProject: () => LAST_PROJECT,
    computeProject,
    buildPdfHtml,
    exportProjectPdfPro,
  });
}


// PDF BLOB (PRO) — même rendu que exportProjectPdfPro()
// ==========================================================
async function buildPdfBlobProFromProject(proj) {
  // ✅ Phase 2 — PH2.23 : extraite dans render/pdf-blob.js
  return buildPdfBlobProFromProjectPure(proj, {
    T, LAST_PROJECT, computeProject, buildPdfHtml, CATALOG,
  });
}


// ===========================================================
// ✅ Phase 2 — handlers data-action extraits dans src/handlers/steps.js
// ===========================================================
const { onStepsClick, onStepsChange, onStepsInput } = createStepsHandlers({
  MODEL,
  render,
  invalidateProjectCache,
  showToast,
  T,
  createEmptyCameraBlock,
  getCameraById,
  invalidateIfNeeded,
  loadConfigFromLocalStorage,
  rebuildAccessoryLinesFromBlocks,
  restoreFromSnapshot,
  sanity,
  suggestAccessories,
  unvalidateBlock,
  updateAccessoryQty: undefined,
  updateNavButtons,
  validateBlock,
  clampInt,
  SAVE_KEY,
  KPI,
  confirmDialog: window.confirm ? window.confirm.bind(window) : (() => false),
});


// ==========================================================
// EXPORT PDF (PRO) — version robuste + logs
// Remplace intégralement ta fonction exportProjectPdfPro()
// ==========================================================
async function exportProjectPdfPro(proj) {
  // ✅ Phase 3 — PH3.2 : extraite dans render/pdf-pro.js
  return exportProjectPdfProPure(proj, {
    T,
    getLastProject: () => LAST_PROJECT,
    setLastProject: (v) => { LAST_PROJECT = v; },
    computeProject, buildPdfBlobProFromProject, kpiConfigSnapshot, KPI, MODEL,
  });
}


// ==========================================================
// TESTS AUTOMATISÉS PDF
// ==========================================================
async function testPdfGeneration(verbose = true) {
  return testPdfGenerationPure(verbose, {
    getLastProject: () => LAST_PROJECT,
    computeProject,
    buildPdfHtml,
    buildPdfBlobProFromProject,
  });
}


// Exposer globalement pour usage en console
window.testPdfGeneration = testPdfGeneration;

// ==========================================================
// EXPORT PACK (PDF + FICHES TECHNIQUES) -> ZIP
// ==========================================================


// Dédup par URL

// Collecte les datasheet_url depuis le projet (tu peux enrichir ensuite)
function collectDatasheetUrlsFromProject(proj) {
  // ✅ Phase 3 — PH3.1 : extraite dans render/datasheet-urls.js
  return collectDatasheetUrlsFromProjectPure(proj, {
    MODEL, getCameraById, sanitizeFilename, localizedDatasheetUrl, dedupByUrl,
    getSelectedOrRecommendedScreen, getSelectedOrRecommendedEnclosure, getSelectedOrRecommendedSign,
  });
}


// Helper pour collecter les IDs produits

async function exportProjectPdfWithLocalDatasheetsZip() {
  // ✅ Phase 2 — PH2.24 : extraite dans render/pdf-export.js
  return exportProjectPdfWithLocalDatasheetsZipPure({
    T,
    getLastProject: () => LAST_PROJECT,
    setLastProject: (v) => { LAST_PROJECT = v; },
    computeProject,
    buildPdfBlobProFromProject,
    collectDatasheetUrlsFromProject,
    MODEL,
  });
}


// Alias pour compatibilité

// Alias pour compatibilité avec l'ancien nom
async function exportProjectPdfPackPro() {
  return await exportProjectPdfWithLocalDatasheetsZip();
}


  // ==========================================================
// 13) NAV / BUTTONS (safe bindings)
// ==========================================================

// ==========================================================
// VALIDATION PAR ÉTAPE
// ==========================================================
function validateStep(stepId) {
  // ✅ Phase 3 — PH3.3 : extraite dans engine/validate-step.js
  return validateStepPure(stepId, { MODEL, T, getProjectCached });
}


function showStepValidationErrors(errors) {
  // ✅ Phase 3 — PH3.3 : extraite dans engine/validate-step.js
  return showStepValidationErrorsPure(errors, { T });
}


// CSS animation pour le toast
if (!document.getElementById("stepValidationStyle")) {
  const style = document.createElement("style");
  style.id = "stepValidationStyle";
  style.textContent = `@keyframes slideUpToast { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`;
  document.head.appendChild(style);
}

function bind(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
}

bind(DOM.btnCompute, "click", () => {
  const stepId = STEPS[MODEL.stepIndex]?.id;

  STEPS.findIndex(s => s.id === "summary");
  STEPS.findIndex(s => s.id === "storage");

  // 1) Projet => vérifie nom + use case
  if (stepId === "project") {
    const errs = validateStep("project");
    if (errs.length) {
      showStepValidationErrors(errs);
      return;
    }
    MODEL.stepIndex++;
    MODEL.ui.resultsShown = false;
    syncResultsUI();
    render();
    return;
  }

  // 2) Caméras => exige au moins 1 caméra validée
  if (stepId === "cameras") {
    const errs = validateStep("cameras");
    if (errs.length) {
      showStepValidationErrors(errs);
      return;
    }
    suggestAccessories();
    MODEL.stepIndex++;
    MODEL.ui.resultsShown = false;
    syncResultsUI();
    render();
    return;
  }

  // 3) Supports
  if (stepId === "mounts") {
    MODEL.stepIndex++;
    MODEL.ui.resultsShown = false;
    syncResultsUI();
    render();
    return;
  }

  // 4) Archivage => simple passage vers Système
  if (stepId === "storage") {
    invalidateProjectCache();
    MODEL.stepIndex++;
    MODEL.ui.resultsShown = false;
    syncResultsUI();
    render();
    return;
  }

  // 5) NVR + Réseau => passage vers Compléments
  if (stepId === "nvr_network") {
    const errs = validateStep("nvr_network");
    if (errs.length) {
      showStepValidationErrors(errs);
      return;
    }
    MODEL.stepIndex++;
    MODEL.ui.resultsShown = false;
    syncResultsUI();
    render();
    return;
  }

  // 6) Compléments => FINALISE + va sur la page Résumé
  if (stepId === "complements") {
    let proj = null;
    try {
      proj = computeProject();
    } catch (e) {
      console.error(e);
      alert("Impossible de finaliser : vérifie les paramètres (caméras/NVR/stockage).");
      return;
    }
    LAST_PROJECT = proj;
    MODEL.ui.resultsShown = true;
    const summaryIdx = STEPS.findIndex(s => s.id === "summary");
    MODEL.stepIndex = summaryIdx >= 0 ? summaryIdx : MODEL.stepIndex + 1;
    // ── KPI : projet finalisé ──
    try {
      if (typeof KPI !== "undefined" && KPI?.sendNowait)
        KPI.sendNowait("reach_summary", KPI.snapshot(proj));
    } catch {}
    syncResultsUI();
    render();
    return;
  }

  // 7) Résumé => ne “reboucle” pas sur stockage via Suivant
  if (stepId === "summary") {
    // No-op : c’est la dernière page.
    // (Le bouton "Modifier la configuration" gère le retour en arrière)
    return;
  }
});

// ✅ Bouton Précédent
    const btnPrevEl = document.getElementById("btnPrev");
    if (btnPrevEl) {
    btnPrevEl.addEventListener("click", () => {
    if (MODEL.stepIndex > 0) {
    MODEL.stepIndex--;
    render();
    updateNavButtons();
    }
    });
    }

bind(DOM.btnReset, "click", () => {
  // ✅ Phase 2 — réinitialisation déléguée à src/state/actions.js
  resetModel(MODEL, LIM);
  LAST_PROJECT = null;
  sanity();
  invalidateProjectCache();
  syncResultsUI();
  render();
  updateNavButtons();
});


bind(DOM.btnDemo, "click", () => {
  MODEL.cameraLines = [];
  MODEL.accessoryLines = [];

  // ✅ Démo : nom de projet ET type de site
  MODEL.project = MODEL.project || {};
  MODEL.project.name = T("demo_project_name");
  MODEL.projectName = T("demo_project_name");
  
  const useCases = getAllUseCases();
  const demoUseCase = useCases.find(u => u.toLowerCase().includes("résidentiel") || u.toLowerCase().includes("residential")) 
    || useCases.find(u => u.toLowerCase().includes("hlm"))
    || useCases[0] 
    || "Résidentiel";
  
  MODEL.projectUseCase = demoUseCase;  // ✅ NOUVEAU

  const b1 = createEmptyCameraBlock();
  b1.label = T("demo_block1");
  b1.qty = 4;
  b1.quality = "high";
  b1.answers.use_case = demoUseCase;
  b1.answers.emplacement = "interieur";
  b1.answers.objective = "identification";
  b1.answers.distance_m = 15;
  b1.answers.mounting = "ceiling";

  const b2 = createEmptyCameraBlock();
  b2.label = T("demo_block2");
  b2.qty = 2;
  b2.quality = "standard";
  b2.answers.use_case = demoUseCase;
  b2.answers.emplacement = "interieur";
  b2.answers.objective = "identification";
  b2.answers.distance_m = 8;
  b2.answers.mounting = "ceiling";

  const b3 = createEmptyCameraBlock();
  b3.label = T("demo_block3");
  b3.qty = 6;
  b3.quality = "high";
  b3.answers.use_case = demoUseCase;
  b3.answers.emplacement = "exterieur";
  b3.answers.objective = "detection";
  b3.answers.distance_m = 30;
  b3.answers.mounting = "wall";

  MODEL.cameraBlocks = [b1, b2, b3];
  MODEL.ui.activeBlockId = b1.id;

  // Valider automatiquement les blocs avec les meilleures caméras
  const r1 = recommendCameraForAnswers(b1.answers);
  const r2 = recommendCameraForAnswers(b2.answers);
  const r3 = recommendCameraForAnswers(b3.answers);
  validateBlock(b1, r1);
  validateBlock(b2, r2);
  validateBlock(b3, r3);

  suggestAccessories();
  
  // ✅ Rester sur l'étape 1 (projet) pour montrer que tout est rempli
  MODEL.stepIndex = 0;
  LAST_PROJECT = null;
  MODEL.ui.resultsShown = false;

  syncResultsUI();
  render();
  updateNavButtons();
  
  // ✅ Message de confirmation
  console.log("[DEMO] Configuration de démonstration chargée:", {
    projet: MODEL.projectName,
    typeSite: MODEL.projectUseCase,
    blocs: MODEL.cameraBlocks.length,
    cameras: MODEL.cameraBlocks.reduce((sum, b) => sum + (b.qty || 1), 0)
  });
});


// EXPORT (PDF)
bind(DOM.btnExportPdf, "click", exportProjectPdfPro);

// Delegation sur #steps (1 seul set de listeners)
bind(DOM.stepsEl, "click", onStepsClick);
bind(DOM.stepsEl, "change", onStepsChange);
bind(DOM.stepsEl, "input", onStepsInput);

  // ==========================================================
  // 14) INIT (load CSV)
  // ==========================================================
  async function init() {
  return initPure({
    DOM,
    KPI,
    loadCsv: loadCsv,
    CATALOG,
    MODEL,
    setLastProject: (v) => { LAST_PROJECT = v; },
    normalizeCamera: normalizeCamera,
    normalizeNvr: normalizeNvr,
    normalizeHdd: normalizeHdd,
    normalizeSwitch: normalizeSwitch,
    normalizeScreen: normalizeScreen,
    normalizeEnclosure: normalizeEnclosure,
    normalizeSignageRow: normalizeSignageRow,
    normalizeAccessoryMapping: normalizeAccessoryMapping,
    applyLocalMediaToCatalog: () => _applyLocalMediaToCatalog(CATALOG),
    sanity,
    syncResultsUI,
    render,
    updateNavButtons,
  });
}

// ==========================================================
// ADMIN PANEL (UI) - utilise /api/login + /api/csv/{name}
// ==========================================================
let ADMIN_TOKEN = null;

// Schémas attendus (minimum) — aide à éviter de casser le configurateur


const _adminRef = { value: (typeof ADMIN_TOKEN !== 'undefined' ? ADMIN_TOKEN : '') };
/* eslint-disable no-unused-vars */
const {
  adminSchemaWarnings, admin$, adminShow, setAdminMode, adminLogin,
  adminLoadCsv, adminSaveCsv, bindAdminPanel, escapeAttr, parseCSVGrid,
  toCSVGrid, syncGridMeta, syncExpertTextareaIfOpen, renderAdminGrid,
  adminGridAddRow, adminGridDupRow, adminGridDelRow, initAdminGridUI,
} = createAdminHandlers({ adminTokenRef: _adminRef });
/* eslint-enable no-unused-vars */
bindAdminPanel();


  init();
  function ensurePdfPackButton() {
  return ensurePdfPackButtonPure({
    T,
    exportProjectPdfWithLocalDatasheetsZip,
  });
}


// Auto-init
if (typeof document !== "undefined") {
  const initPdfButtons = () => setTimeout(ensurePdfPackButton, 500);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdfButtons);
  } else {
    initPdfButtons();
  }
}

console.log("[PDF-FIX v2] Corrections chargées avec récupération automatique du projet.");

