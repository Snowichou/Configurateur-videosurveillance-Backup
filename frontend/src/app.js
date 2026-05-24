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

/* ============================================================
   KPI (tracking) — envoi côté backend
   - Stockage local: session_id
   - Envoi best-effort (pas bloquant)
   ============================================================ */
const KPI = (() => {
  const SESSION_KEY = "cfg_session_id";

  function getSessionId() {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto?.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  async function send(event, payload = {}) {
    try {
      const body = {
        session_id: getSessionId(),
        event: String(event || "").slice(0, 80),
        payload: payload && typeof payload === "object" ? payload : { value: payload },
      };

      await fetch("/api/kpi/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-page-path": location.pathname + location.search + location.hash,
        },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // jamais casser l'app pour un KPI
    }
  }

  // ✅ compat : si ton code appelle KPI.sendNowait(...)
  function sendNowait(event, payload = {}) {
    // "fire & forget" : on ne await pas
    try { send(event, payload); } catch {}
  }

  return { send, sendNowait, getSessionId };
})();

// ✅ IMPORTANT : rend KPI accessible partout (handlers inclus)
window.KPI = KPI;

// ✅ compat : si tu as des appels kpi("event", {...})
window.kpi = function kpi(event, payload = {}) {
  try {
    if (window.KPI?.sendNowait) window.KPI.sendNowait(event, payload);
    else if (window.KPI?.send) window.KPI.send(event, payload);
  } catch {}
};


function kpiConfigSnapshot(proj) {
  return window._kpiConfigSnapshotPure(proj, {
    MODEL,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedSign,
  });
}



(() => {
  "use strict";


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



  const isFalseLike = (v) => {
    if (v == null) return true;
    const s = String(v).trim().toLowerCase();
    return s === "" || s === "false" || s === "0" || s === "no" || s === "n";
  };

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
  const uid = window._uid;

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


function pickScreenBySize(sizeInch) {
  const screens = CATALOG.SCREENS || [];
  if (!screens.length) return null;

  // 1) match exact
  let exact = screens.find(s => Number(s.size_inch) === Number(sizeInch));
  if (exact) return exact;

  // 2) fallback: closest
  let best = null, bestDelta = Infinity;
  for (const s of screens) {
    const v = Number(s.size_inch);
    if (!Number.isFinite(v)) continue;
    const d = Math.abs(v - Number(sizeInch));
    if (d < bestDelta) { bestDelta = d; best = s; }
  }
  return best || screens[0] || null;
}
const SCREEN_INSIDE_ONLY_ID = "MMON185A";

function isScreenInsideCompatible(enclosure, screen) {
  if (!enclosure || !screen) return false;

  // 1) Si le CSV boîtier donne une liste explicite
  if (Array.isArray(enclosure.screen_compatible_with) && enclosure.screen_compatible_with.length) {
    return enclosure.screen_compatible_with.includes(screen.id);
  }

  // 2) fallback selon ta règle business
  return screen.id === SCREEN_INSIDE_ONLY_ID;
}

function pickBestEnclosure(proj, screen) {
  const encs = CATALOG.ENCLOSURES || [];
  const nvrId = proj?.nvrPick?.nvr?.id || null;
  if (!encs.length || !nvrId) {
    return { enclosure: null, reason: "no_nvr_or_catalog", screenInsideOk: false };
  }

  const encNvrCompatible = encs.filter(e =>
    Array.isArray(e.compatible_with) && e.compatible_with.includes(nvrId)
  );

  if (!encNvrCompatible.length) {
    // Aucun boîtier compatible NVR
    return { enclosure: null, reason: "no_enclosure_for_nvr", screenInsideOk: false };
  }

  // Si écran choisi, on tente un boîtier qui accepte l’écran à l’intérieur
  if (screen) {
    const encBoth = encNvrCompatible.find(e => isScreenInsideCompatible(e, screen));
    if (encBoth) return { enclosure: encBoth, reason: "nvr_and_screen_ok", screenInsideOk: true };

    // Sinon on prend le meilleur compatible NVR mais on indiquera écran outside
    return { enclosure: encNvrCompatible[0], reason: "nvr_ok_screen_not_inside", screenInsideOk: false };
  }

  // Pas d’écran : on prend le meilleur compatible NVR
  return { enclosure: encNvrCompatible[0], reason: "nvr_ok_no_screen", screenInsideOk: false };
}





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
    return window._scoreCameraForBlockPure(block, cam, {
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
  return window._interpretScoreForBlockPure(block, cam, {
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



function objectiveLabel(obj){
  const labels = {
    detection: T("cam_detection").split("(")[0].trim(),
    observation: T("cam_observation").split("(")[0].trim(),
    reconnaissance: T("cam_recognition").split("(")[0].trim(),
    identification: T("cam_identification").split("(")[0].trim(),
    dissuasion: T("cam_observation").split("(")[0].trim(),
  };
  return labels[obj] || T("cam_identification").split("(")[0].trim();
}


function accessoryTypeLabel(t){
  return ({
    junction_box: T("mount_junction"),
    wall_mount: T("mount_bracket"),
    ceiling_mount: T("cam_ceiling") + " " + T("mount_bracket").toLowerCase(),
  }[t] || t);
}

  (text) => {
    const t = safeHtml(text || "");
    if (!t) return "";
    return `<span class="badgePill">${t}</span>`;
  };

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
  // ==========================================================
  // 2) MODEL (state) — factory extraite dans src/state/model.js (Phase 2)
  // ==========================================================
  const MODEL = window._createInitialModel(LIM);
  window._MODEL = MODEL;

const KPI = (() => {
  const SESSION_KEY = "cfg_session_id";

  function getSessionId() {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  function _buildBody(event, payload) {
    return {
      session_id: getSessionId(),
      event: String(event || "").slice(0, 80),
      payload: payload && typeof payload === "object" ? payload : { value: payload },
    };
  }

  // ✅ Ton send "attendu" (garde la signature) — mais on ne veut pas bloquer l'app
  async function send(event, payload = {}) {
    try {
      const body = _buildBody(event, payload);

      await fetch("/api/kpi/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-page-path": location.pathname + location.search + location.hash,
        },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // ne casse jamais l'app
    }
  }

  // ✅ Fire-and-forget : recommandé pour tous les events UI (aucune latence)
  function sendNowait(event, payload = {}) {
    try {
      const body = _buildBody(event, payload);
      fetch("/api/kpi/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-page-path": location.pathname + location.search + location.hash,
        },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  // ------------------------------------------------------------
  // KPI "normaux" (métier) : snapshot de configuration
  // ------------------------------------------------------------

  function compactCameras() {
    // attend tes structures existantes : MODEL.cameraLines + getCameraById()
    const lines = Array.isArray(MODEL?.cameraLines) ? MODEL.cameraLines : [];
    const blocks = Array.isArray(MODEL?.cameraBlocks) ? MODEL.cameraBlocks : [];
    const cams = [];

    for (const l of lines) {
      const camId = l?.cameraId;
      if (!camId) continue;
      const cam = (typeof getCameraById === "function") ? getCameraById(camId) : null;
      if (!cam) continue;
      // Retrouver l'objectif DORI depuis le bloc source
      const block = blocks.find(b => b.id === l.fromBlockId);
      const objective = block?.answers?.objective || block?.objective || null;
      cams.push({
        id: cam.id,
        name: cam.name || "",
        qty: Number(l.qty || 0) || 0,
        brand_range: cam.brand_range || "",   // ex: "NEXT", "ADVANCE", "EASY"
        objective: objective,                  // ex: "detection", "observation", "identification"
        emplacement: block?.answers?.emplacement || null,  // "interieur" | "exterieur"
        distance_m: (Number(block?.answers?.distance_m) > 0 ? Number(block.answers.distance_m) : null),
      });
    }
    return cams.filter(c => c.qty > 0);
  }

  function snapshot(proj) {
    const cams = compactCameras();
    const cam_total_qty = cams.reduce((a, c) => a + (Number(c.qty) || 0), 0);

    const nvr_id = proj?.nvrPick?.nvr?.id || proj?.nvr?.id || null;

    // ── Config type ──
    const config_type =
      MODEL?.projectUseCase ||
      proj?.siteType || proj?.vertical || proj?.environment ||
      (cam_total_qty >= 8 ? "multi-cam" : "petit-site");

    // ── Compléments ──
    const comp = MODEL?.complements || {};
    const screen_enabled    = !!comp?.screen?.enabled;
    const enclosure_enabled = !!comp?.enclosure?.enabled;
    const signage_enabled   = !!comp?.signage?.enabled;
    const screen_size_inch  = screen_enabled ? (Number(comp?.screen?.sizeInch || 0) || null) : null;
    const screen_qty        = screen_enabled ? (Number(comp?.screen?.qty || 1) || 1) : null;
    const signage_scope     = signage_enabled ? String(comp?.signage?.scope || "Public") : null;
    const signage_qty       = signage_enabled ? (Number(comp?.signage?.qty || 1) || 1) : null;

    // ── HDD ──
    const hdd_ref  = proj?.disks?.hddRef || null;
    const hdd_id   = hdd_ref?.id || null;
    const hdd_name = hdd_ref?.name || null;
    const hdd_qty  = (hdd_ref && proj?.disks?.count) ? Number(proj.disks.count) : null;

    // ── Stockage — lire depuis proj.storageParams (source de vérité de computeProject) ──
    const sp = proj?.storageParams || {};
    const required_tb = Number(proj?.requiredTB ?? proj?.rawRequiredTB ?? 0) > 0
      ? Number(proj?.requiredTB ?? proj?.rawRequiredTB) : null;
    const total_mbps  = Number(proj?.totalInMbps ?? 0) > 0
      ? Number(proj.totalInMbps) : null;

    // ── Enregistrement ──
    const rec_codec = sp.codec ?? MODEL?.recording?.codec ?? null;
    const rec_fps   = sp.ips   ?? MODEL?.recording?.fps   ?? null;
    const rec_days  = sp.daysRetention  ?? MODEL?.recording?.daysRetention  ?? null;
    const rec_hours = sp.hoursPerDay    ?? MODEL?.recording?.hoursPerDay    ?? null;
    const rec_mode  = sp.mode           ?? MODEL?.recording?.mode           ?? null;

    return {
      sid: getSessionId(),
      config_type,
      cam_total_qty,
      unique_cam_models: cams.length,
      cameras: cams,
      nvr_id,
      // ── Stockage (noms alignés avec kpiConfigSnapshot) ──
      requiredTB:  required_tb,
      totalInMbps: total_mbps,
      recording: {
        daysRetention: rec_days,
        hoursPerDay:   rec_hours,
        codec:         rec_codec,
        fps:           rec_fps,
        mode:          rec_mode,
      },
      hdd_id, hdd_name, hdd_qty,
      complements: {
        screen_enabled, screen_size_inch, screen_qty,
        enclosure_enabled,
        signage_enabled, signage_scope, signage_qty,
      },
    };
  }

  return { send, sendNowait, getSessionId, snapshot };
})();

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

function safeStr(v) {
  return (v ?? "").toString().trim();
}

// i18n: Adapt datasheet URL locale (/fr_FR/ or /fr-fr/ → /xx_XX/ or /xx-xx/)
function localizedDatasheetUrl(url) {
  if (!url || url === "false") return url;
  const lang = (typeof _currentLang !== "undefined") ? _currentLang : "fr";
  const localeMap = { fr: "fr_FR", en: "en_GB", it: "it_IT", es: "es_ES", de: "de_DE" };
  const localeMapDash = { fr: "fr-fr", en: "en-gb", it: "it-it", es: "es-es", de: "de-de" };
  const targetLocale = localeMap[lang] || "fr_FR";
  const targetLocaleDash = localeMapDash[lang] || "fr-fr";
  let result = url.replace(/\/fr_FR\//g, "/" + targetLocale + "/");
  result = result.replace(/\/fr-fr\//g, "/" + targetLocaleDash + "/");
  return result;
}


// ==========================================================
  // 4A) SIGNAGE (panneaux de signalisation)
  // ==========================================================
  // CSV attendu (tes colonnes):
  // id,name,material,fixing,Dimension,Prive_Public,image_url,datasheet_url

function getSignages() {
    return Array.isArray(CATALOG.SIGNAGE) ? CATALOG.SIGNAGE : [];
  }

  function pickSignageByScope(scope) {
    const wanted = safeStr(scope || "Public").toLowerCase();
    const signs = getSignages();

    // match exact d’abord
    let hit = signs.find((s) => safeStr(s.scope).toLowerCase() === wanted);
    if (hit) return hit;

    // fallback : si "privé" indispo -> public, et inverse
    if (wanted.includes("priv")) {
      hit = signs.find((s) => safeStr(s.scope).toLowerCase().includes("public"));
      if (hit) return hit;
    } else {
      hit = signs.find((s) => safeStr(s.scope).toLowerCase().includes("priv"));
      if (hit) return hit;
    }

    // fallback final
    return signs[0] || null;
  }

  function getSelectedOrRecommendedSign() {
    const enabled = !!MODEL.complements?.signage?.enabled;
    if (!enabled) return { sign: null, reason: "disabled" };

    const scope = MODEL.complements.signage.scope || "Public";
    const sign = pickSignageByScope(scope);
    if (!sign) return { sign: null, reason: "no_catalog" };
    return { sign, reason: "scope_match" };
  }

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

  function getAllUseCases() {
    const set = new Set();
    for (const c of CATALOG.CAMERAS) {
      for (const u of (c.use_cases || [])) {
        if (!isFalseLike(u)) set.add(String(u).trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }

  // i18n: traduire les noms de use cases du CSV
  function translateUseCase(uc) {
    const map = {
      "Résidentiel": T("uc_residential"),
      "Tertiaire": T("uc_tertiary"),
      "Logement collectif": T("uc_collective"),
      "Intrusion humaine": T("uc_intrusion"),
      "Intrusion humaine + Dissuasion active": T("uc_intrusion_active"),
    };
    return map[uc] || uc;
  }
window._getCameraById = getCameraById;
  // ==========================================================
  // 6) ENGINE - RECO CAMERA (V3 — profils métier + pool élargi)
  // ==========================================================

  const CAMERA_PROFILES = {
    "Tertiaire|interieur": {
      preferred: ["turret", "dome", "fish-eye"],
      penalized: ["ptz", "lpr"],
      ptzMinDistance: 50,
    },
    "Tertiaire|exterieur": {
      preferred: ["bullet", "dome"],
      penalized: ["fish-eye", "lpr"],
      ptzMinDistance: 35,
    },
    "Résidentiel|interieur": {
      preferred: ["turret", "dome"],
      penalized: ["ptz", "bullet", "lpr"],
      ptzMinDistance: 999,
    },
    "Résidentiel|exterieur": {
      preferred: ["bullet", "turret"],
      penalized: ["ptz", "lpr", "fish-eye"],
      ptzMinDistance: 60,
    },
    "Logement collectif|interieur": {
      preferred: ["dome"],
      penalized: ["ptz", "bullet", "lpr", "turret"],
      ptzMinDistance: 999,
    },
    "Logement collectif|exterieur": {
      preferred: ["bullet", "dome"],
      penalized: ["lpr", "fish-eye", "turret"],
      ptzMinDistance: 35,  // PTZ acceptable dès 35m en collectif ext
    },
    "Parking|interieur": {
      preferred: ["dome"],
      penalized: ["turret", "ptz", "bullet", "fish-eye"],
      ptzMinDistance: 999,
    },
    "Parking|exterieur": {
      preferred: ["dome", "bullet", "lpr"],
      penalized: ["turret", "fish-eye"],
      ptzMinDistance: 40,
    },
  };

  function getCameraProfile(useCase, emplacement) {
    const key = `${useCase}|${emplacement}`;
    if (CAMERA_PROFILES[key]) return CAMERA_PROFILES[key];
    if (emplacement === "interieur") return { preferred: ["turret","dome"], penalized: ["ptz","lpr"], ptzMinDistance: 50 };
    if (emplacement === "exterieur") return { preferred: ["bullet","dome","turret"], penalized: [], ptzMinDistance: 40 };
    return { preferred: [], penalized: [], ptzMinDistance: 40 };
  }


    function recommendCameraForAnswers(ans) {
    // ✅ Phase 2 — logique extraite dans src/engine/camera-reco.js
    return window._recommendCameraForAnswersPure(ans, {
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
    return window._createEmptyCameraBlockPure(MODEL.projectUseCase || '');
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
  if (!Array.isArray(MODEL.cameraBlocks) || MODEL.cameraBlocks.length === 0) {
    MODEL.cameraBlocks = [createEmptyCameraBlock()];
  }
  if (!MODEL.ui) MODEL.ui = {};

  // Champs UI requis (safe defaults)
  if (!MODEL.ui.activeBlockId && MODEL.cameraBlocks[0]) MODEL.ui.activeBlockId = MODEL.cameraBlocks[0].id;
  if (typeof MODEL.ui.resultsShown !== "boolean") MODEL.ui.resultsShown = false;

  if (MODEL.ui.mode !== "simple" && MODEL.ui.mode !== "expert") MODEL.ui.mode = "simple";
  if (typeof MODEL.ui.demo !== "boolean") MODEL.ui.demo = false;
  if (typeof MODEL.ui.onlyFavs !== "boolean") MODEL.ui.onlyFavs = false;

  if (!Array.isArray(MODEL.ui.favorites)) MODEL.ui.favorites = [];
  if (!Array.isArray(MODEL.ui.compare)) MODEL.ui.compare = [];
  if (!MODEL.ui.previewByBlock || typeof MODEL.ui.previewByBlock !== "object") MODEL.ui.previewByBlock = {};

  // Dé-doublonnage + garde-fous
  MODEL.ui.favorites = Array.from(new Set(MODEL.ui.favorites.map(String)));
  MODEL.ui.compare = Array.from(new Set(MODEL.ui.compare.map(String))).slice(0, 2);

  // Nettoyage preview (si bloc supprimé)
  const blockIds = new Set((MODEL.cameraBlocks || []).map(b => b.id));
  for (const k of Object.keys(MODEL.ui.previewByBlock || {})) {
    if (!blockIds.has(k)) delete MODEL.ui.previewByBlock[k];
  }

  applyDemoClass();
}


  function rebuildAccessoryLinesFromBlocks() {
    // ✅ Phase 2 — logique extraite dans src/engine/accessories.js
    MODEL.accessoryLines = window._buildAccessoryLinesPure(MODEL.cameraBlocks, MODEL.cameraLines);
  }

  function unvalidateBlock(block) {
    block.validated = false;

    if (block.validatedLineId) {
      const idx = MODEL.cameraLines.findIndex((l) => l.lineId === block.validatedLineId);
      if (idx >= 0) MODEL.cameraLines.splice(idx, 1);
    }
    block.validatedLineId = null;

    block.accessories = [];
    rebuildAccessoryLinesFromBlocks();
  }

  // ✅ Invalidation légère : si un bloc déjà "validé" est modifié,
// on le repasse en non-validé + on reset le cache projet pour forcer recompute.
function invalidateIfNeeded(block, reason = "Modification") {
  try {
    // Toujours invalider le cache de rendu/calcul projet
    // (sinon computeProject() peut rester sur un résultat ancien)
    if (typeof _renderProjectCache !== "undefined") invalidateProjectCache();

    if (!block) return;

    // Si le bloc était validé, on le "dévalide" proprement
    if (block.validated) {
      if (typeof unvalidateBlock === "function") {
        unvalidateBlock(block, reason);
      } else {
        // fallback ultra-safe
        block.validated = false;
        block.selectedCameraId = "";
      }
    }
  } catch (e) {
    console.warn("[invalidateIfNeeded] fallback", e);
    try {
      if (typeof _renderProjectCache !== "undefined") invalidateProjectCache();
    } catch {}
  }
}

  function suggestAccessoriesForBlock(block) {
    // ✅ Phase 2 — logique extraite dans src/engine/accessories.js
    const line = MODEL.cameraLines.find((l) => l.fromBlockId === block.id);
    const cam = line ? getCameraById(line.cameraId) : null;
    const mapRow = cam ? CATALOG.ACCESSORIES_MAP.get(cam.id) : null;
    block.accessories = window._computeBlockAccessoriesPure(
      {
        cam,
        mapRow,
        mounting: block.answers.mounting || "wall",
        camQty: clampInt(line?.qty || 1, 1, 999),
      },
      { clampInt }
    );
  }

  function suggestAccessories() {
    for (const blk of (MODEL.cameraBlocks || [])) {
      if (!blk.validated) continue;
      suggestAccessoriesForBlock(blk);
    }
    rebuildAccessoryLinesFromBlocks();
  }

  function validateBlock(block, reco, forcedCameraId = null) {
    const chosenId = forcedCameraId || block.selectedCameraId || reco?.primary?.camera?.id || null;
    const cam = chosenId ? getCameraById(chosenId) : null;
    if (!cam) {
      alert("Impossible de valider : aucune caméra sélectionnable pour ce bloc.");
      return;
    }

    const qty = clampInt(Number(block.qty || 1), 1, 999);
    block.qty = qty; // ✅ on fixe le type définitivement après validation

    const quality = block.quality || "standard";

    if (block.validatedLineId) {
      const line = MODEL.cameraLines.find((l) => l.lineId === block.validatedLineId);
      if (line) {
        line.cameraId = cam.id;
        line.qty = qty;
        line.quality = quality;
        line.fromBlockId = block.id;
      } else {
        block.validatedLineId = null;
      }
    }

    if (!block.validatedLineId) {
      const lineId = uid("LINE");
      MODEL.cameraLines.push({ lineId, cameraId: cam.id, qty, quality, fromBlockId: block.id });
      KPI.sendNowait("validate_camera", KPI.snapshot());
      block.validatedLineId = lineId;
    }

    block.validated = true;
    block.selectedCameraId = cam.id;

    // ✅ Score /100 stocké dans le bloc (sert pour Résumé + PDF)
    const sc = scoreCameraForBlock(block, cam);
    block.selectedCameraScore = sc.score;
    block.selectedCameraScoreParts = sc.parts; // optionnel

    suggestAccessoriesForBlock(block);
    rebuildAccessoryLinesFromBlocks();
  }

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
    return window._computeCriticalProjectScorePure(MODEL.cameraBlocks);
  }


  function computeTotals() {
    // ✅ Phase 2 — logique extraite dans src/engine/totals.js
    return window._computeTotalsPure(MODEL.cameraLines, MODEL.recording, { getCameraById });
  }

  function pickNvr(totalCameras, totalInMbps, requiredTB) {
    // ✅ Phase 2 — logique extraite dans src/engine/pick-nvr.js
    return window._pickNvrPure(totalCameras, totalInMbps, requiredTB, {
      cameraLines: MODEL.cameraLines,
      getCameraById,
      catalogNvrs: CATALOG.NVRS,
      catalogHdds: CATALOG.HDDS,
      T,
    });
  }

  function planPoESwitches(totalCameras, reservePct = 10, nvr = null) {
    // ✅ Phase 2 — logique extraite dans src/engine/poe.js
    return window._planPoESwitchesPure(totalCameras, reservePct, nvr, CATALOG.SWITCHES);
  }

  function mbpsToTB(mbps, hoursPerDay, days, overheadPct) {
    const seconds = hoursPerDay * 3600 * days;
    const bits = mbps * 1_000_000 * seconds;
    const bytes = bits / 8;
    let tb = bytes / 1_000_000_000_000;
    tb *= (1 + (overheadPct / 100));
    return tb;
  }

  function pickDisks(requiredTB, nvr) {
    if (!nvr) return null;
    const bays = nvr.hdd_bays ?? 0;
    const maxPerBay = nvr.max_hdd_tb_per_bay ?? 0;
    const maxTotalTB = bays * maxPerBay;

    const sizesFromHdds = [...new Set(CATALOG.HDDS.map((h) => h.capacity_tb).filter((x) => Number.isFinite(x)))]
      .sort((a, b) => b - a);

    const candidateSizes = sizesFromHdds.length ? sizesFromHdds : [16, 12, 8, 4];

    let best = null;
    for (const size of candidateSizes) {
      if (size > maxPerBay) continue;
      const needed = Math.ceil(requiredTB / size);
      if (needed <= bays) {
        best = { sizeTB: size, count: needed, totalTB: needed * size };
        break;
      }
    }

    if (!best) {
      const size = Math.min(maxPerBay, candidateSizes[0] ?? maxPerBay);
      best = { sizeTB: size, count: bays, totalTB: bays * size };
    }

    const hddRef = CATALOG.HDDS.find((h) => h.capacity_tb === best.sizeTB) || null;
    return { ...best, maxTotalTB, hddRef };
  }




 // ✅ Phase 2 -- calcul projet extrait dans src/engine/project.js
  function computeProject() {
    return window._computeProjectPure({
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


function recommendScreenForProject(totalCameras) {
  const screens = CATALOG.SCREENS || [];
  if (!screens.length) return null;

  // Heuristique simple (tu pourras raffiner plus tard)
  const target =
    totalCameras <= 8  ? 24 :
    totalCameras <= 16 ? 32 :
    totalCameras <= 32 ? 43 : 55;

  // Choisir le plus proche
  let best = null;
  let bestDelta = Infinity;

  for (const s of screens) {
    const size = Number(s.size_inch);
    if (!Number.isFinite(size)) continue;

    const d = Math.abs(size - target);
    if (d < bestDelta) { bestDelta = d; best = s; }
  }

  return best || screens[0] || null;
}

function recommendEnclosureForNvr(nvrId) {
  const encs = CATALOG.ENCLOSURES || [];
  if (!encs.length || !nvrId) return null;

  // compatible_with = liste de refs NVR séparées par |
  const found = encs.find(e => Array.isArray(e.compatible_with) && e.compatible_with.includes(nvrId));
  return found || null;
}

function getSelectedOrRecommendedScreen(proj) {
  const screens = CATALOG.SCREENS || [];
  if (!screens.length) return { selected: null, recommended: null };

  const selected = MODEL.complements.screen.enabled
    ? pickScreenBySize(MODEL.complements.screen.sizeInch)
    : null;

  const recommended = recommendScreenForProject(proj.totalCameras) || null;
  return { selected: selected || null, recommended };
}
function recommendEnclosureForProject(proj) {
  const nvrId = proj?.nvrPick?.nvr?.id || null;
  if (!nvrId) return null;
  return recommendEnclosureForNvr(nvrId);
}

function getSelectedOrRecommendedEnclosure(proj) {
  const encs = CATALOG.ENCLOSURES || [];
  if (!encs.length) return { selected: null, recommended: null };

  // Ton UX actuelle : boîtier "auto" si enabled
  if (MODEL.complements.enclosure.enabled) {
    const screenSel = MODEL.complements.screen.enabled
      ? pickScreenBySize(MODEL.complements.screen.sizeInch)
      : null;

    const enclosureAuto = pickBestEnclosure(proj, screenSel);
    return { selected: enclosureAuto.enclosure || null, recommended: recommendEnclosureForProject(proj) };
  }

  return { selected: null, recommended: recommendEnclosureForProject(proj) };
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
  return window._renderFinalSummaryPure(proj, {
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
const getThumbSrc = window._getThumbSrc;
function applyLocalMediaToCatalog() {
  return window._applyLocalMediaToCatalogPure(CATALOG);
}

  function buildPdfHtml(proj) {
    // ✅ Phase 2 — génération HTML PDF extraite dans src/render/pdf.js
    return window._buildPdfHtmlPure(proj, {
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
} = window._createRenderPipeline({
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



// updateNavButtons() via window._createRenderPipeline



  // ==========================================================
  // 10) UI - STEPS RENDER
  // ==========================================================
  // updateProgress() via window._createRenderPipeline


  function canRecommendBlock(blk) {
      const ans = blk?.answers || {};
      const d = toNum(ans.distance_m);
      // ✅ CORRIGÉ : ne vérifie plus use_case
      return !!ans.emplacement && !!ans.objective && Number.isFinite(d) && d > 0;
    }

  function buildRecoForBlock(blk) {
    if (!canRecommendBlock(blk)) return null;
    const ans = blk.answers;
    return recommendCameraForAnswers({
      use_case: ans.use_case || MODEL.projectUseCase || "",  // ✅ CORRIGÉ : fallback
      emplacement: ans.emplacement,
      objective: ans.objective,
      distance_m: toNum(ans.distance_m),
    });
  }


function camPickCardHTML(blk, cam) {
  // ✅ Phase 2 — composition HTML extraite dans src/render/camera-card.js
  return window._renderCameraPickCardPure(blk, cam, {
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
    return window._renderStepCamerasPure({
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
    if (_SSO_USER && _SSO_USER.oid) {
      const isAzure = !!_SSO_USER.sso;
      const userLabel = isAzure
        ? safeHtml(_SSO_USER.email || _SSO_USER.name || "utilisateur")
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
    return window._renderStepProjectPure({
      model: MODEL,
      T, safeHtml,
      csvUseCases: getAllUseCases(),
      limits: LIM,
      projectTipHtml,
      useCaseDescriptionHtml,
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
    return window._renderStepAccessoriesPure({
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
    return window._renderStepNvrNetworkPure({
      proj: getProjectCached(),
      isManual: !!MODEL.overrideNvrId,
      T, safeHtml,
      localizedDatasheetUrl,
    });
  }

  function renderStepStorage() {
    // ✅ Phase 2 — composition HTML extraite dans src/render/storage.js
    return window._renderStepStoragePure({
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
    return window._renderStepComplementsPure({
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
  return window._renderStepSummaryPure({
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
  return window._bindSummaryButtonsPure({
    MODEL, STEPS, T,
    syncResultsUI, render,
    exportProjectPdfPro, showPdfPreview, exportProjectPdfPackPro,
    saveConfigToLocalStorage, shareConfigUrl, requestQuote, sendToDistributor,
  });
}


// ==========================================================
// SAUVEGARDE, PARTAGE & TRANSITION COMMERCIALE — engine/persistence.js
// ==========================================================
const {
  snapshotForSave, restoreFromSnapshot,
  saveConfigToLocalStorage, loadConfigFromLocalStorage, shareConfigUrl,
} = window._createPersistenceHandlers({
  get MODEL() { return MODEL; },
  LOG,
  showToast,
  T,
  generateShareUrl: () => generateShareUrl(),
  invalidateProjectCache,
});

function requestQuote() {
  const proj = LAST_PROJECT;
  if (!proj) { showToast("⚠️ Finalise ta configuration d'abord.", "warn"); return; }
  const subject = encodeURIComponent("Demande de devis — " + (MODEL.projectName || "Projet vidéosurveillance"));
  const cams = (MODEL.cameraLines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const nvrId = proj.nvrPick?.nvr?.id || "—";
  const camDetails = (MODEL.cameraLines || []).map(l => {
    const cam = typeof getCameraById === "function" ? getCameraById(l.cameraId) : null;
    return (l.qty || 1) + "× " + (cam?.id || l.cameraId) + " — " + (cam?.name || "");
  }).join("\n");
  const body = encodeURIComponent(
    "Bonjour,\n\n" +
    "Je souhaite obtenir un devis pour la configuration suivante :\n\n" +
    "━━━ PROJET ━━━\n" +
    "Nom : " + (MODEL.projectName || "—") + "\n" +
    T("proj_site_type_label") + " : " + (MODEL.projectUseCase || "—") + "\n\n" +
    "━━━ CAMÉRAS (" + cams + ") ━━━\n" +
    camDetails + "\n\n" +
    "━━━ ENREGISTREMENT ━━━\n" +
    "NVR : " + nvrId + "\n" +
    T("pdf_required_storage") + " : " + (proj.requiredTB?.toFixed(1) || "—") + " To\n" +
    "Codec : " + (MODEL.recording?.codec || "h265").toUpperCase() + " • " + (MODEL.recording?.fps || 25) + " FPS\n" +
    "Rétention : " + (MODEL.recording?.daysRetention || 30) + " jours\n\n" +
    "━━━ RÉSEAU ━━━\n" +
    "Débit total : " + (proj.totalInMbps?.toFixed(1) || "—") + " Mbps\n\n" +
    "Merci de me recontacter avec une proposition chiffrée.\n" +
    "Le PDF de configuration est disponible en pièce jointe.\n\n" +
    "Cordialement"
  );
  window.open("mailto:devis@comelit.fr?subject=" + subject + "&body=" + body, "_blank");
  showToast("✉️ Email pré-rempli ouvert vers devis@comelit.fr", "ok");
}

function sendToDistributor() {
  const url = generateShareUrl();
  if (navigator.share) {
    navigator.share({ title: "Configuration Comelit — " + (MODEL.projectName || ""), url: url || window.location.href })
      .then(() => showToast("✅ Partagé !", "ok")).catch(() => {});
  } else if (url) {
    navigator.clipboard.writeText(url).then(() => showToast("🔗 Lien copié — transmets-le à ton distributeur.", "ok"))
      .catch(() => prompt("Copie ce lien :", url));
  } else showToast("⚠️ Génère le PDF et envoie-le par email.", "warn");
}

function showToast(message, type) {
  return window._showToastPure(message, type, CLR);
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
// render() + _renderImmediate() via window._createRenderPipeline



// ==========================================================

// ==========================================================
// QR CODE — Utilise qrcode.js (CDN) pour générer un QR data URL
// ==========================================================
function generateQRDataUrl(text, size = 150) {
  // ✅ Phase 3 — PH3.4 : extraite dans utils/share.js
  return window._generateQRDataUrlPure(text, size);
}


// ==========================================================
// SHARE URL — Génère l'URL de partage pour le QR code
// ==========================================================
function generateShareUrl() {
  // ✅ Phase 3 — PH3.4 : extraite dans utils/share.js
  return window._generateShareUrlPure({ snapshotForSave, MODEL });
}


// ==========================================================
// APERÇU PDF — Preview HTML dans une modale
// ==========================================================
function showPdfPreview() {
  // ✅ Phase 2 — PH2.25 : extraite dans render/pdf-preview.js
  return window._showPdfPreviewPure({
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
  return window._buildPdfBlobProFromProjectPure(proj, {
    T, LAST_PROJECT, computeProject, buildPdfHtml, CATALOG,
  });
}





// ===========================================================
// ✅ Phase 2 — handlers data-action extraits dans src/handlers/steps.js
// ===========================================================
const { onStepsClick, onStepsChange, onStepsInput } = window._createStepsHandlers({
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
  return window._exportProjectPdfProPure(proj, {
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
  return window._testPdfGenerationPure(verbose, {
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


function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[\/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// Dédup par URL
function dedupByUrl(items) {
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

// Collecte les datasheet_url depuis le projet (tu peux enrichir ensuite)
function collectDatasheetUrlsFromProject(proj) {
  // ✅ Phase 3 — PH3.1 : extraite dans render/datasheet-urls.js
  return window._collectDatasheetUrlsFromProjectPure(proj, {
    MODEL, getCameraById, sanitizeFilename, localizedDatasheetUrl, dedupByUrl,
    getSelectedOrRecommendedScreen, getSelectedOrRecommendedEnclosure, getSelectedOrRecommendedSign,
  });
}


// Helper pour collecter les IDs produits

async function exportProjectPdfWithLocalDatasheetsZip() {
  // ✅ Phase 2 — PH2.24 : extraite dans render/pdf-export.js
  return window._exportProjectPdfWithLocalDatasheetsZipPure({
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
  return window._validateStepPure(stepId, { MODEL, T, getProjectCached });
}


function showStepValidationErrors(errors) {
  // ✅ Phase 3 — PH3.3 : extraite dans engine/validate-step.js
  return window._showStepValidationErrorsPure(errors, { T });
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
  window._resetModel(MODEL, LIM);
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
  return window._initPure({
    DOM,
    KPI,
    loadCsv: window._loadCsvPure,
    CATALOG,
    MODEL,
    setLastProject: (v) => { LAST_PROJECT = v; },
    normalizeCamera: window._normalizeCameraPure,
    normalizeNvr: window._normalizeNvrPure,
    normalizeHdd: window._normalizeHddPure,
    normalizeSwitch: window._normalizeSwitchPure,
    normalizeScreen: window._normalizeScreenPure,
    normalizeEnclosure: window._normalizeEnclosurePure,
    normalizeSignageRow: window._normalizeSignageRowPure,
    normalizeAccessoryMapping: window._normalizeAccessoryMappingPure,
    applyLocalMediaToCatalog,
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
} = window._createAdminHandlers({ adminTokenRef: _adminRef });
/* eslint-enable no-unused-vars */
bindAdminPanel();


  init();
  function ensurePdfPackButton() {
  return window._ensurePdfPackButtonPure({
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

})();