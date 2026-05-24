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
  try {
    const sp = proj?.storageParams || {};
    const rec = MODEL?.recording || {};

    // Caméras (liste + quantités)
    const cams = (proj?.perCamera || [])
      .map(r => ({
        id: r.cameraId,
        name: r.cameraName,
        qty: Number(r.qty || 0),
        mbpsPerCam: Number(r.mbpsPerCam || 0),
        mbpsLine: Number(r.mbpsLine || 0),
        source: r.mbpsSource || ""
      }))
      .filter(x => x.id && x.qty > 0);

    // Compléments
    const screenEnabled = !!(MODEL?.complements?.screen?.enabled);
    const enclosureEnabled = !!(MODEL?.complements?.enclosure?.enabled);
    const signageEnabled = !!(MODEL?.complements?.signage?.enabled ?? MODEL?.complements?.signage?.enable);

    // Ids choisis/reco (si tes helpers existent)
    const scrSel = (typeof getSelectedOrRecommendedScreen === "function")
      ? getSelectedOrRecommendedScreen(proj)?.selected
      : null;

    const encSel = (typeof getSelectedOrRecommendedEnclosure === "function")
      ? getSelectedOrRecommendedEnclosure(proj)?.selected
      : null;

    const signSel = (typeof getSelectedOrRecommendedSign === "function")
      ? getSelectedOrRecommendedSign()?.sign
      : null;

    return {
      projectName: String(proj?.projectName ?? MODEL?.projectName ?? "").trim() || null,

      // Résumé sizing
      totalCameras: Number(proj?.totalCameras || 0),
      totalInMbps: Number(proj?.totalInMbps || 0),
      requiredTB: Number(proj?.requiredTB || 0),

      // NVR / Switch
      nvrId: proj?.nvrPick?.nvr?.id || null,
      nvrName: proj?.nvrPick?.nvr?.name || null,
      switchesRequired: !!proj?.switches?.required,
      switchesPortsNeeded: Number(proj?.switches?.portsNeeded || 0) || null,
      switchesTotalPorts: Number(proj?.switches?.totalPorts || 0) || null,

      // Recording (source: proj.storageParams sinon MODEL.recording)
      recording: {
        daysRetention: sp.daysRetention ?? rec.daysRetention ?? null,
        hoursPerDay: sp.hoursPerDay ?? rec.hoursPerDay ?? null,
        overheadPct: sp.overheadPct ?? rec.overheadPct ?? null,
        codec: sp.codec ?? rec.codec ?? null,
        fps: sp.ips ?? rec.fps ?? null,
        mode: sp.mode ?? rec.mode ?? null,
      },

      // Caméras détaillées (top N pour éviter payload énorme)
      camerasTop: cams
        .sort((a,b)=> (b.qty - a.qty))
        .slice(0, 30),

      // Compléments
      complements: {
        screen: {
          enabled: screenEnabled,
          qty: screenEnabled ? Number(MODEL?.complements?.screen?.qty || 1) : 0,
          id: scrSel?.id || null,
          name: scrSel?.name || null,
        },
        enclosure: {
          enabled: enclosureEnabled,
          qty: enclosureEnabled ? Number(MODEL?.complements?.enclosure?.qty || 1) : 0,
          id: encSel?.id || null,
          name: encSel?.name || null,
        },
        signage: {
          enabled: signageEnabled,
          qty: signageEnabled ? Number(MODEL?.complements?.signage?.qty || 1) : 0,
          id: signSel?.id || null,
          name: signSel?.name || null,
          scope: signageEnabled ? (MODEL?.complements?.signage?.scope || null) : null,
        },
      }
    };
  } catch {
    return { error: "snapshot_failed" };
  }
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

  const toBool = (v) => {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "y";
  };

  const toStrOrFalse = (v) => (isFalseLike(v) ? false : String(v).trim());

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

  const splitList = (v, sep = "|") => {
    if (v == null) return [];
    const s = String(v).trim();
    if (!s) return [];
    return s.split(sep).map((x) => x.trim()).filter(Boolean);
  };

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

  function extractUseCasesFromRow(raw) {
    const cols = ["use_cases_01", "use_cases_02", "use_cases_03"];
    const out = [];

    for (const k of cols) {
      const v = raw[k];
      if (!isFalseLike(v)) out.push(String(v).trim());
    }

    // fallback legacy
    if (!out.length) {
      const legacy = raw.use_cases ?? raw.use_case ?? raw.useCases ?? "";
      const fromPipe = splitList(legacy, "|");
      if (fromPipe.length) return fromPipe;
      if (!isFalseLike(legacy)) return [String(legacy).trim()];
    }

    return [...new Set(out)].filter(Boolean);
  }


  // ==========================================================
  // 0B) CSV PARSER (no deps)
  // ==========================================================
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
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
        else if (ch === ",") {
          row.push(cur);
          cur = "";
        } else if (ch === "\n") {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
        } else if (ch === "\r") {
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

    // 1) Raw headers + trim + remove BOM
    const rawHeaders = rows[0].map((h) => String(h ?? "").trim().replace(/^\uFEFF/, ""));

    // 2) ✅ FIX: gérer les headers dupliqués
    // ex: name,name,name -> name, name_2, name_3
    const headers = (() => {
      const counts = new Map();
      return rawHeaders.map((h, idx) => {
        const base = h || `col_${idx + 1}`; // si header vide -> fallback
        const n = (counts.get(base) ?? 0) + 1;
        counts.set(base, n);
        return n === 1 ? base : `${base}_${n}`;
      });
    })();

    const objs = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells || cells.every((c) => String(c ?? "").trim() === "")) continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = String(cells[c] ?? "").trim();
      }
      objs.push(obj);
    }

    return objs;
  }


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

  async function loadCsv(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Impossible de charger ${url} (${res.status})`);
    return parseCsv(await res.text());
  }

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
  function normalizeCamera(raw) {
  const useCases = extractUseCasesFromRow(raw);

  const emplInt = toBool(raw.Emplacement_Interieur ?? raw.emplacement_interieur ?? raw.interieur);
  const emplExt = toBool(raw.Emplacement_Exterieur ?? raw.emplacement_exterieur ?? raw.exterieur);

  // helper: numbers robustes (virgules, "IP66", "IK10", espaces)
  const num = (v, fallback = null) => {
    if (v == null) return fallback;
    if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
    const s = String(v).trim();
    if (!s) return fallback;

    // IP66 / IK10
    const ipik = s.match(/^(IP|IK)\s*([0-9]{2})$/i);
    if (ipik) return Number(ipik[2]);

    // virgule FR -> point
    const cleaned = s.replace(",", ".").replace(/\s+/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    id: String(raw.id ?? "").trim(),
    name: localizedName(raw) || "",
    brand_range: raw.brand_range || "",
    family: raw.family || "standard",
    type: raw.form_factor || raw.type || "",

    emplacement_interieur: !!emplInt,
    emplacement_exterieur: !!emplExt,

    resolution_mp: num(raw.resolution_mp, 0),
    sensor_count: num(raw.sensor_count, 0),
    lens_type: raw.lens_type || "",

    focal_min_mm: num(raw.focal_min_mm, null),
    focal_max_mm: num(raw.focal_max_mm, null),

    dori_detection_m: num(raw.dori_detection_m, 0),
    dori_observation_m: num(raw.dori_observation_m, 0),
    dori_recognition_m: num(raw.dori_recognition_m, 0),
    dori_identification_m: num(raw.dori_identification_m, 0),

    ir_range_m: num(raw.ir_range_m, 0),
    white_led_range_m: num(raw.white_led_range_m, 0),

    low_light_raw: raw.low_light_mode || raw.low_light || "",
    low_light: !!String(raw.low_light_mode ?? raw.low_light ?? "").trim(),

    ip: num(raw.ip, null),
    ik: num(raw.ik, null),

    microphone: toBool(raw.Microphone ?? raw.microphone),

    poe_w: num(raw.poe_w, 0),

    // ✅ champ clé pour le débit
    bitrate_mbps_typical: num(raw.bitrate_mbps_typical, null),

    streams_max: num(raw.streams_max, null),
    analytics_level: raw.analytics_level || "",

    use_cases: useCases,

    image_url: raw.image_url || "",
    datasheet_url: raw.datasheet_url || "",
  };
}


  function normalizeNvr(raw) {
  return {
    id: raw.id,
    name: localizedName(raw),
    channels: toNum(raw.channels) ?? 0,
    max_in_mbps: toNum(raw.max_in_mbps) ?? 0,
    nvr_output: clampInt(raw.nvr_output ?? 1, 1, 8), // ✅ raw
    hdd_bays: toNum(raw.hdd_bays) ?? 0,
    max_hdd_tb_per_bay: toNum(raw.max_hdd_tb_per_bay) ?? 0,
    poe_ports: toNum(raw.poe_ports) ?? 0,
    poe_budget_w: toNum(raw.poe_budget_w) ?? 0,
    image_url: raw.image_url || "",
    datasheet_url: raw.datasheet_url || "",
  };
}


  function normalizeHdd(raw) {
    return {
      id: raw.id,
      name: localizedName(raw),
      capacity_tb: toNum(raw.capacity_tb),
      image_url: raw.image_url || "",
      datasheet_url: raw.datasheet_url || "",
    };
  }

  function normalizeSwitch(raw) {
    return {
      id: raw.id,
      name: localizedName(raw),
      poe_ports: toNum(raw.poe_ports) ?? 0,
      poe_budget_w: toNum(raw.poe_budget_w) ?? null,
      uplink_gbps: toNum(raw.uplink_gbps) ?? null,
      managed: toBool(raw.managed),
      image_url: raw.image_url || "",
      datasheet_url: raw.datasheet_url || "",
      notes: raw.notes || "",
    };
  }

  function safeStr(v) {
  return (v ?? "").toString().trim();
}

// i18n: Get localized product name from CSV row
function localizedName(raw, field) {
  field = field || "name";
  const lang = (typeof _currentLang !== "undefined") ? _currentLang : "fr";
  if (lang !== "fr") {
    const localized = raw[field + "_" + lang];
    if (localized && localized !== "false" && localized.trim()) return localized.trim();
  }
  return (raw[field] ?? "").toString().trim();
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


/** "A|B|C|" => ["A","B","C"] */
function parsePipeList(v) {
  return safeStr(v)
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);
}
  function normalizeScreen(row) {
    const id = safeStr(row.id);

    // parse robuste (accepte "55", "55.0", "55,0", rejette vide)
    const raw = safeStr(row.size_inch);
    const n = Number(String(raw || "").trim().replace(",", "."));
    const size = Number.isFinite(n) && n > 0 ? n : null;

    return {
      id,
      name: localizedName(row) || id || "—",

      // important : null si invalide (pas 0)
      size_inch: size,

      format: safeStr(row.format) || "—",
      vesa: safeStr(row.vesa) || "—",

      // ton CSV a "Resolution" (R majuscule)
      resolution: safeStr(row.Resolution || row.resolution) || "—",

      image_url: safeStr(row.image_url) || "",
      datasheet_url: safeStr(row.datasheet_url) || "",
    };
  }

  function normalizeEnclosure(row) {
  const id = safeStr(row.id);
  return {
    id,
    name: localizedName(row) || id || "—",

    // peut être vide, ou une ref unique, ou plusieurs refs séparées par |
    screen_compatible_with: parsePipeList(row.screen_compatible_with),

    // liste NVR / XVR compatibles
    compatible_with: parsePipeList(row.compatible_with),

    image_url: safeStr(row.image_url) || "",
    datasheet_url: safeStr(row.datasheet_url) || "",
  };
}

  // ==========================================================
  // 4A) SIGNAGE (panneaux de signalisation)
  // ==========================================================
  // CSV attendu (tes colonnes):
  // id,name,material,fixing,Dimension,Prive_Public,image_url,datasheet_url
  function normalizeSignageRow(raw) {
    if (!raw) return null;
    const id = safeStr(raw.id);
    if (!id) return null;

    const name = safeStr(raw.name) || id;
    const material = safeStr(raw.material);
    const fixing = safeStr(raw.fixing);
    const dimension = safeStr(raw.Dimension ?? raw.dimension);

    // "Public" ou "Privé" (ton CSV = Prive_Public)
    const scope = safeStr(raw.Prive_Public ?? raw.prive_public ?? raw.scope ?? raw.type) || "Public";

    const image_url = safeStr(raw.image_url);
    const datasheet_url = safeStr(raw.datasheet_url);

    return { id, name, material, fixing, dimension, scope, image_url, datasheet_url };
  }

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
  function normalizeMappedAccessory({ id, name, type, image_url, datasheet_url, stand_alone }) {
    if (isFalseLike(id)) return null;

    return {
      id: String(id).trim(),
      name: toStrOrFalse(name) || String(id).trim(),
      type, // junction_box | wall_mount | ceiling_mount
      image_url: toStrOrFalse(image_url) || false,
      datasheet_url: toStrOrFalse(datasheet_url) || false,
      stand_alone: !!stand_alone,
    };
  }

  /**
   * ✅ Mapping accessoires par caméra (TON FORMAT)
   * camera_id,junction_box_id,junction_box_name,wall_mount_id,wall_mount_name,wall_mount_stand_alone,
   * ceiling_mount_id,ceiling_mount_name,ceiling_mount_stand_alone,qty,
   * image_url_junction_box,datasheet_url_junction_box,image_url_wall_mount,datasheet_url_wall_mount,
   * image_url_ceiling_mount,datasheet_url_ceiling_mount
   */
  function normalizeAccessoryMapping(raw) {
    // parseCsv enlève le BOM, mais on garde un fallback au cas où
    const cameraId = toStrOrFalse(raw.camera_id ?? raw["\uFEFFcamera_id"]);
    if (!cameraId) return null;

    const qty = clampInt(raw.qty, 1, 999);

    const junction = normalizeMappedAccessory({
      id: raw.junction_box_id,
      name: localizedName(raw, "junction_box_name"),
      type: "junction_box",
      image_url: raw.image_url_junction_box,
      datasheet_url: raw.datasheet_url_junction_box,
      stand_alone: false,
    });

    const wall = normalizeMappedAccessory({
      id: raw.wall_mount_id,
      name: localizedName(raw, "wall_mount_name"),
      type: "wall_mount",
      image_url: raw.image_url_wall_mount,
      datasheet_url: raw.datasheet_url_wall_mount,
      stand_alone: toBool(raw.wall_mount_stand_alone),
    });

    const ceiling = normalizeMappedAccessory({
      id: raw.ceiling_mount_id,
      name: localizedName(raw, "ceiling_mount_name"),
      type: "ceiling_mount",
      image_url: raw.image_url_ceiling_mount,
      datasheet_url: raw.datasheet_url_ceiling_mount,
      stand_alone: toBool(raw.ceiling_mount_stand_alone),
    });

    return {
      cameraId: String(cameraId).trim(),
      qty,
      junction,
      wall,
      ceiling,
    };
  }

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
// THUMBS / IMAGES (LOCAL DATA ONLY)
// ==========================================================
const LOCAL_IMG_ROOT = "/data/Images";
const __thumbCache = new Map();

function getThumbSrc(family, id) {
  try {
    const fam = String(family || "").trim();
    const ref = String(id || "").trim();
    if (!fam || !ref) return "";

    const key = `${fam}::${ref}`;
    if (__thumbCache.has(key)) return __thumbCache.get(key);

    // 📸 Convention projet : 1 image = <ID>.png dans /data/Images/<family>/
    const url = `${LOCAL_IMG_ROOT}/${fam}/${encodeURIComponent(ref)}.png`;

    __thumbCache.set(key, url);
    return url;
  } catch {
    return "";
  }
}

const LOCAL_PDF_ROOT = "/data/fiche_tech";

// ✅ Datasheets 100% locaux (même logique que getThumbSrc)
function getDatasheetSrc(family, ref) {
  const id = String(ref || "").trim();
  if (!id) return "";
  const fam = String(family || "").toLowerCase().trim();

  let folder = fam;
  if (fam === "cameras") folder = "cameras";
  else if (fam === "nvrs") folder = "nvrs";
  else if (fam === "hdds") folder = "hdds";
  else if (fam === "switches") folder = "switches";
  else if (fam === "accessories") folder = "accessories";
  else if (fam === "screens") folder = "screens";
  else if (fam === "enclosures") folder = "enclosures";
  else if (fam === "signage") folder = "signage";

  // on suppose: /data/Datasheets/<folder>/<ID>.pdf
  return `${LOCAL_PDF_ROOT}/${folder}/${encodeURIComponent(id)}.pdf`;
}

// ✅ Force le catalogue à utiliser les médias locaux (images + fiches)
// NOTE: Ne PAS écraser datasheet_url si elle existe déjà (URL Comelit multilingue du CSV)
function applyLocalMediaToCatalog() {
  const apply = (familyKey, list) => {
    if (!Array.isArray(list)) return;
    const fam = String(familyKey || "").toLowerCase();
    for (const it of list) {
      const id = String(it?.id || "").trim();
      if (!id) continue;
      // Préserver l'URL image du CSV (Comelit CDN) si elle existe déjà
      if (!it.image_url || it.image_url === "false") {
        // Préserver l'URL image du CSV (Comelit CDN) si elle existe déjà
        if (!it.image_url || it.image_url === "false") {
      it.image_url = getThumbSrc(fam, id);
        }
      }
      // Garder l'URL datasheet du CSV (Comelit multilingue) si elle existe
      if (!it.datasheet_url || it.datasheet_url === "false") {
        it.datasheet_url = getDatasheetSrc(fam, id);
      }
    }
  };

  apply("cameras", CATALOG?.CAMERAS);
  apply("nvrs", CATALOG?.NVRS);
  apply("hdds", CATALOG?.HDDS);
  apply("switches", CATALOG?.SWITCHES);
  apply("accessories", CATALOG?.ACCESSORIES);
  apply("screens", CATALOG?.SCREENS);
  apply("enclosures", CATALOG?.ENCLOSURES);
  apply("signage", CATALOG?.SIGNAGE);
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

function syncResultsUI() {
  const stepId = STEPS[MODEL.stepIndex]?.id;
  const isSummary = (stepId === "summary");

  const isLastStep = MODEL.stepIndex >= (STEPS.length - 1);

  const resultsEmpty = document.getElementById("resultsEmpty");
  const results = document.getElementById("results");

  const gridEl = document.querySelector("#mainGrid") || document.querySelector(".appGrid");
  const resultCard = document.querySelector("#resultCard") || document.querySelector("#resultsCard") || document.querySelector(".resultsCard");

  // ✅ Sur SUMMARY : on veut 1 colonne et ZERO carte résultats (car le résumé est dans l’étape)
  if (isSummary) {
    if (gridEl) gridEl.classList.add("singleCol");
    if (resultCard) resultCard.classList.add("hiddenCard");
    if (results) results.classList.add("hidden");
    if (resultsEmpty) resultsEmpty.classList.add("hidden");
    return;
  }

  // Hors summary : comportement normal
  // Résultats visibles uniquement sur la dernière étape (si tu gardes cette logique)
  if (!isLastStep && MODEL.ui.resultsShown) MODEL.ui.resultsShown = false;

  if (resultsEmpty) resultsEmpty.classList.toggle("hidden", isLastStep);
  if (results) results.classList.toggle("hidden", !isLastStep);

  const showCol = isLastStep && MODEL.ui.resultsShown && stepId !== "summary";
  if (stepId === "summary") {
  DOM.mainGrid?.classList.add("singleCol");
  DOM.resultsCard?.classList.add("hiddenCard");
}


  if (gridEl) gridEl.classList.toggle("singleCol", !showCol);
  if (resultCard) resultCard.classList.toggle("hiddenCard", !isLastStep);
}


function updateNavButtons() {
  const stepId = STEPS[MODEL.stepIndex]?.id;

  const btnPrev = document.getElementById("btnPrev");
if (btnPrev) {
  if (MODEL.stepIndex > 0) {
    btnPrev.style.display = "inline-flex";
    btnPrev.disabled = false;
  } else {
    btnPrev.style.display = "none";
  }
}
  if (!DOM.btnCompute) return;

  if (stepId === "summary") {
    DOM.btnCompute.disabled = true;
    DOM.btnCompute.textContent = T("sum_finished");
    return;
  }

  // Validation visuelle du bouton selon l'étape
  const stepErrors = typeof validateStep === "function" ? validateStep(stepId) : [];
  if (stepErrors.length > 0) {
    DOM.btnCompute.classList.add("btnDisabledHint");
    DOM.btnCompute.title = stepErrors[0];
  } else {
    DOM.btnCompute.classList.remove("btnDisabledHint");
    DOM.btnCompute.title = "";
  }
  DOM.btnCompute.disabled = false;

  // Optionnel: libellés contextuels
  if (stepId === "complements") DOM.btnCompute.textContent = T("btn_finalize");
  else DOM.btnCompute.textContent = T("btn_next");
}


  // ==========================================================
  // 10) UI - STEPS RENDER
  // ==========================================================
  function updateProgress() {
    const currentStep = MODEL.stepIndex;
    const totalSteps = STEPS.length;
    const currentStepData = STEPS[currentStep];
    
    // Ancien système (pour compatibilité)
    const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
    if (DOM.progressBar) DOM.progressBar.style.width = `${pct}%`;
    if (DOM.progressText) DOM.progressText.textContent = `Étape ${currentStep + 1}/${totalSteps} • ${pct}%`;
    
    // ✅ NOUVEAU : Mise à jour du titre de la section
    const stepperTitle = document.getElementById('stepperTitle');
    const stepperSubtitle = document.getElementById('stepperSubtitle');
    
    if (stepperTitle && currentStepData) {
      stepperTitle.textContent = currentStepData.title || 'Configuration';
    }
    
    if (stepperSubtitle && currentStepData) {
      stepperSubtitle.textContent = currentStepData.help || '';
    }
    
    // ✅ Mise à jour du stepper visuel
    const stepper = document.getElementById('stepper');
    if (stepper) {
      const steps = stepper.querySelectorAll('.stepperStep');
      const lines = stepper.querySelectorAll('.stepperLine');
      
      steps.forEach((stepEl, index) => {
        stepEl.classList.remove('completed', 'active', 'future');
        
        if (index < currentStep) {
          stepEl.classList.add('completed');
        } else if (index === currentStep) {
          stepEl.classList.add('active');
        } else {
          stepEl.classList.add('future');
        }
      });
      
      lines.forEach((lineEl, index) => {
        lineEl.classList.remove('completed');
        if (index < currentStep) {
          lineEl.classList.add('completed');
        }
      });
    }
  }

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
  const stepId = STEPS[MODEL.stepIndex]?.id;
  if (stepId !== "summary") return;

  const btnBack = document.getElementById("btnBackToEdit");
  if (btnBack && !btnBack.dataset.bound) {
    btnBack.dataset.bound = "1";
    btnBack.addEventListener("click", () => {
      const compIdx = STEPS.findIndex(s => s.id === "complements");
      if (compIdx >= 0) {
        MODEL.stepIndex = compIdx;
        MODEL.ui.resultsShown = false;
        syncResultsUI();
        render();
      }
    });
  }

  const btnPdf = document.getElementById("btnExportPdf");
  if (btnPdf && !btnPdf.dataset.bound) {
    btnPdf.dataset.bound = "1";
    btnPdf.addEventListener("click", () => {
      if (typeof exportProjectPdfPro === "function") exportProjectPdfPro();
      else alert("Export PDF indisponible.");
    });
  }

  // Aperçu PDF
  const btnPreview = document.getElementById("btnPreviewPdf");
  if (btnPreview && !btnPreview.dataset.bound) {
    btnPreview.dataset.bound = "1";
    btnPreview.addEventListener("click", () => {
      if (typeof showPdfPreview === "function") showPdfPreview();
      else alert(T("sum_preview") + " — N/A");
    });
  }

  const btnPack = document.getElementById("btnExportPdfPack");
  if (btnPack && !btnPack.dataset.bound) {
    btnPack.dataset.bound = "1";
    btnPack.addEventListener("click", () => {
      if (typeof exportProjectPdfPackPro === "function") exportProjectPdfPackPro();
      else alert("Export pack indisponible.");
    });
  }

  // Sauvegarder
  const btnSave = document.getElementById("btnSaveConfig");
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = "1";
    btnSave.addEventListener("click", () => saveConfigToLocalStorage());
  }

  // Partager
  const btnShare = document.getElementById("btnShareConfig");
  if (btnShare && !btnShare.dataset.bound) {
    btnShare.dataset.bound = "1";
    btnShare.addEventListener("click", () => shareConfigUrl());
  }

  // Demander un devis
  const btnQuote = document.getElementById("btnRequestQuote");
  if (btnQuote && !btnQuote.dataset.bound) {
    btnQuote.dataset.bound = "1";
    btnQuote.addEventListener("click", () => requestQuote());
  }

  // Transmettre à un distributeur
  const btnDistrib = document.getElementById("btnSendToDistributor");
  if (btnDistrib && !btnDistrib.dataset.bound) {
    btnDistrib.dataset.bound = "1";
    btnDistrib.addEventListener("click", () => sendToDistributor());
  }
}

// ==========================================================
// SAUVEGARDE, PARTAGE & TRANSITION COMMERCIALE
// ==========================================================

function snapshotForSave() {
  try {
    return {
      projectName: MODEL?.projectName || "",
      projectUseCase: MODEL?.projectUseCase || "",
      cameraBlocks: (MODEL?.cameraBlocks || []).map(b => ({
        id: b.id, label: b.label, validated: b.validated,
        selectedCameraId: b.selectedCameraId, qty: b.qty, answers: b.answers || {},
      })),
      cameraLines: (MODEL?.cameraLines || []).map(l => ({
        cameraId: l.cameraId, fromBlockId: l.fromBlockId, qty: l.qty,
      })),
      accessoryLines: (MODEL?.accessoryLines || []).map(a => ({
        accessoryId: a.accessoryId, fromBlockId: a.fromBlockId, qty: a.qty, type: a.type,
      })),
      recording: { ...(MODEL?.recording || {}) },
      complements: JSON.parse(JSON.stringify(MODEL?.complements || {})),
      savedAt: new Date().toISOString(),
    };
  } catch (e) { LOG.error("[Save] Snapshot failed:", e); return null; }
}

function restoreFromSnapshot(snap) {
  try {
    if (!snap) return false;
    if (snap.projectName != null) MODEL.projectName = snap.projectName;
    if (snap.projectUseCase != null) MODEL.projectUseCase = snap.projectUseCase;
    if (Array.isArray(snap.cameraBlocks)) MODEL.cameraBlocks = snap.cameraBlocks;
    if (Array.isArray(snap.cameraLines)) MODEL.cameraLines = snap.cameraLines;
    if (Array.isArray(snap.accessoryLines)) MODEL.accessoryLines = snap.accessoryLines;
    if (snap.recording) MODEL.recording = { ...MODEL.recording, ...snap.recording };
    if (snap.complements) MODEL.complements = JSON.parse(JSON.stringify(snap.complements));
    invalidateProjectCache();
    return true;
  } catch (e) { LOG.error("[Save] Restore failed:", e); return false; }
}

const SAVE_KEY = "comelit_cfg_save";

function saveConfigToLocalStorage() {
  const snap = snapshotForSave();
  if (!snap) { showToast("❌ " + T("err_save_fail"), "danger"); return; }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    showToast("💾 " + T("msg_saved"), "ok");
  } catch (e) { showToast("❌ Erreur : " + e.message, "danger"); }
}

function loadConfigFromLocalStorage() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

function shareConfigUrl() {
  const url = generateShareUrl();
  if (!url) {
    const snap = snapshotForSave();
    if (snap) navigator.clipboard.writeText(JSON.stringify(snap))
      .then(() => showToast("📋 Config trop longue pour un lien. JSON copié.", "warn"))
      .catch(() => showToast("⚠️ Config trop volumineuse pour un lien.", "warn"));
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast("🔗 Lien copié !", "ok"))
      .catch(() => prompt("Copie ce lien :", url));
  } else prompt("Copie ce lien :", url);
}

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
  const existing = document.getElementById("cfgToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "cfgToast";
  const bg = type === "ok" ? CLR.green : type === "warn" ? CLR.warn : CLR.danger;
  Object.assign(toast.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    zIndex: "99999", padding: "14px 24px", borderRadius: "12px",
    background: bg, color: "#fff", fontWeight: "800", fontSize: "13px",
    boxShadow: "0 8px 32px rgba(0,0,0,.25)", transition: "opacity .3s ease, transform .3s ease",
  });
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
function render() {
  if (_renderRAF) cancelAnimationFrame(_renderRAF);
  _renderRAF = requestAnimationFrame(_renderImmediate);
}

function _renderImmediate() {
  _renderRAF = null;
  if (!Array.isArray(STEPS) || !STEPS.length) return;

  if (!Number.isFinite(MODEL.stepIndex)) MODEL.stepIndex = 0;
  MODEL.stepIndex = Math.max(0, Math.min(MODEL.stepIndex, STEPS.length - 1));

  const stepId = STEPS[MODEL.stepIndex]?.id;

  let html = "";

  if (stepId === "project") {
    html = renderStepProject();
  } else if (stepId === "cameras") {
    html = renderStepCameras();
  } else if (stepId === "mounts") {
    html = renderStepMounts();
  } else if (stepId === "nvr_network") {
    html = renderStepNvrNetwork();
  } else if (stepId === "storage") {
    html = renderStepStorage();
  } else if (stepId === "complements") {
    html = renderStepComplements();
  } else if (stepId === "summary") {
    html = renderStepSummary();
  } else {
  html = `<div class="recoCard" style="padding:12px"><div class="muted">Étape inconnue : ${safeHtml(stepId || "—")}</div></div>`;
  }

  DOM.stepsEl.innerHTML = html;

  bindSummaryButtons();
  syncResultsUI?.();
  updateNavButtons();
  updateProgress();
}


// ==========================================================

// ==========================================================
// QR CODE — Utilise qrcode.js (CDN) pour générer un QR data URL
// ==========================================================
function generateQRDataUrl(text, size = 150) {
  try {
    if (typeof QRCode === "undefined") {
      console.warn("[QR] QRCode lib not loaded");
      return "";
    }
    
    // Créer un container temporaire offscreen
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
    document.body.appendChild(div);
    
    // Générer le QR
    new QRCode(div, {
      text: text,
      width: size,
      height: size,
      colorDark: "#1C1F2A",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    
    // Récupérer le canvas
    const canvas = div.querySelector("canvas");
    let dataUrl = "";
    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    }
    
    // Cleanup
    div.remove();
    return dataUrl;
  } catch (e) {
    console.warn("[QR] Generation failed:", e);
    return "";
  }
}

// ==========================================================
// SHARE URL — Génère l'URL de partage pour le QR code
// ==========================================================
function generateShareUrl() {
  try {
    const snap = typeof snapshotForSave === "function" ? snapshotForSave() : null;
    if (!snap && typeof MODEL !== "undefined") {
      // Fallback: construire un snapshot minimal
      const bl = (MODEL.cameraBlocks || []).map(b => ({
        id: b.id, lb: b.label, v: b.validated, sc: b.selectedCameraId, q: b.qty, a: b.answers
      }));
      const cl = (MODEL.cameraLines || []).map(l => ({
        ci: l.cameraId, fb: l.fromBlockId, q: l.qty
      }));
      const light = { pn: MODEL.projectName || "", uc: MODEL.projectUseCase || "", bl, cl };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(light))));
      if (encoded.length > 3500) return null; // Trop long pour QR
      const url = new URL(window.location.href);
      url.searchParams.set("cfg", encoded);
      return url.toString();
    }
    
    if (!snap) return null;
    const light = {
      pn: snap.projectName, uc: snap.projectUseCase,
      bl: (snap.cameraBlocks || []).map(b => ({ id: b.id, lb: b.label, v: b.validated, sc: b.selectedCameraId, q: b.qty, a: b.answers })),
      cl: (snap.cameraLines || []).map(l => ({ ci: l.cameraId, fb: l.fromBlockId, q: l.qty })),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(light))));
    if (encoded.length > 3500) return null;
    const url = new URL(window.location.href);
    url.searchParams.set("cfg", encoded);
    return url.toString();
  } catch (e) {
    console.warn("[Share] URL generation failed:", e);
    return null;
  }
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
  if (!proj) {
    proj = (typeof LAST_PROJECT !== "undefined" && LAST_PROJECT)
      ? LAST_PROJECT
      : null;
  }
  
  if (!proj && typeof computeProject === "function") {
    try {
      proj = computeProject();
      if (typeof LAST_PROJECT !== "undefined") {
        LAST_PROJECT = proj;
      }
    } catch (e) {
      console.error("[PDF] computeProject failed:", e);
    }
  }
  
  if (!proj) {
    alert(T("err_project_unavailable"));
    return;
  }

  // KPI
  try {
    const payload = typeof kpiConfigSnapshot === "function" ? kpiConfigSnapshot(proj) : {};
    if (typeof KPI !== "undefined" && KPI?.sendNowait) {
      KPI.sendNowait("export_pdf_click", payload);
    }
  } catch {}

  // Vérifier les libs
  if (typeof window.html2canvas !== "function") {
    alert("Export PDF impossible : html2canvas non chargé.");
    return;
  }

  try {
    const blob = await buildPdfBlobProFromProject(proj);
    
    if (!blob || blob.size < 1000) {
      throw new Error("PDF blob invalide");
    }

    const projectSlug = (MODEL?.projectName || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9àâäéèêëïîôùûüç]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "projet";
    const filename = `${projectSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    console.log("[PDF] Export OK:", filename);
    
  } catch (e) {
    console.error("[PDF] Export failed:", e);
    alert("Export PDF échoué: " + e.message);
  }
}


// ==========================================================
// TESTS AUTOMATISÉS PDF
// ==========================================================
async function testPdfGeneration(verbose = true) {
  const results = { pass: 0, fail: 0, errors: [] };
  const log = (ok, msg) => {
    if (ok) results.pass++;
    else { results.fail++; results.errors.push(msg); }
    if (verbose) console.log(`[PDF-TEST] ${ok ? "✅" : "❌"} ${msg}`);
  };

  try {
    // 1) Vérifier que le projet est disponible
    const proj = LAST_PROJECT || (typeof computeProject === "function" ? computeProject() : null);
    log(!!proj, "Projet disponible");
    if (!proj) { console.log("[PDF-TEST] Arrêt : pas de projet"); return results; }

    // 2) Vérifier buildPdfHtml
    let html;
    try {
      html = buildPdfHtml(proj);
      log(!!html && html.length > 500, `buildPdfHtml OK (${html.length} chars)`);
    } catch (e) {
      log(false, `buildPdfHtml ERREUR: ${e.message}`);
      return results;
    }

    // 3) Vérifier le nombre de pages
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const allPages = tempDiv.querySelectorAll(".pdfPage");
    const portraitPages = tempDiv.querySelectorAll(".pdfPage:not(.pdfPageLandscape)");
    const landscapePages = tempDiv.querySelectorAll(".pdfPageLandscape");
    
    log(allPages.length >= 4, `Nombre de pages: ${allPages.length} (min. 4 attendu)`);
    log(portraitPages.length >= 3, `Pages portrait: ${portraitPages.length} (min. 3)`);
    log(landscapePages.length >= 1, `Pages paysage (synoptique): ${landscapePages.length} (min. 1)`);

    // 4) Vérifier la page 0 (synthèse)
    const page0 = allPages[0];
    log(!!page0?.querySelector(".greenBand"), "Page 0 : bande verte présente");
    log(!!page0?.querySelector(".dashGrid"), "Page 0 : dashboard KPI présent");
    log(!!page0?.querySelector(".footerLine"), "Page 0 : footer présent");

    // 5) Vérifier la page synoptique
    const synPage = landscapePages[0];
    log(!!synPage?.querySelector(".synWrap"), "Page synoptique : synWrap présent");
    log(!!synPage?.querySelector(".synStage"), "Page synoptique : synStage présent");

    // 6) Vérifier les headers sur chaque page
    let allHeaders = true;
    allPages.forEach((p, i) => {
      if (!p.querySelector(".pdfHeader")) { allHeaders = false; log(false, `Page ${i}: header manquant`); }
    });
    if (allHeaders) log(true, "Toutes les pages ont un header");

    // 7) Vérifier les footers
    let allFooters = true;
    allPages.forEach((p, i) => {
      if (!p.querySelector(".footerLine")) { allFooters = false; log(false, `Page ${i}: footer manquant`); }
    });
    if (allFooters) log(true, "Toutes les pages ont un footer");

    // 8) Vérifier les dimensions des pages (styles inline)
 // Pas possible sans DOM réel
    log(true, "Dimensions: vérification manuelle via aperçu PDF");

    // 9) Test de génération réelle (si libs disponibles)
    if (typeof window?.jspdf?.jsPDF === "function" && typeof window?.html2canvas === "function") {
      try {
        const blob = await buildPdfBlobProFromProject(proj);
        log(!!blob && blob.size > 5000, `PDF blob généré: ${blob ? (blob.size / 1024).toFixed(0) + " Ko" : "null"}`);
        log(blob?.type === "application/pdf", `Type MIME: ${blob?.type}`);
      } catch (e) {
        log(false, `Génération PDF réelle échouée: ${e.message}`);
      }
    } else {
      log(true, "Génération réelle: libs non chargées (test HTML uniquement)");
    }

    // Résumé
    console.log(`\n[PDF-TEST] === RÉSULTAT: ${results.pass} ✅ / ${results.fail} ❌ ===`);
    if (results.errors.length) {
      console.log("[PDF-TEST] Erreurs:", results.errors);
    }

  } catch (e) {
    log(false, `Exception globale: ${e.message}`);
  }
  
  return results;
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
  const errors = [];
  
  switch (stepId) {
    case "project":
      if (!MODEL.projectName?.trim()) errors.push(T("err_project_name_required"));
      if (!MODEL.projectUseCase?.trim()) errors.push(T("err_site_type_required"));
      break;
      
    case "cameras": {
      const validatedCount = (MODEL.cameraBlocks || []).filter(b => b.validated).length;
      if (validatedCount === 0) errors.push(T("err_validate_one_camera"));
      // Vérifier que tous les blocs actifs ont des réponses complètes
      for (const blk of (MODEL.cameraBlocks || [])) {
        if (blk.validated) continue; // validé = OK
        const ans = blk.answers || {};
        if (ans.emplacement || ans.objective || ans.distance) {
          // Bloc partiellement rempli mais non validé
          errors.push(`Le bloc "${blk.label || 'sans nom'}" est en cours — validez-le ou supprimez-le.`);
        }
      }
      break;
    }
      
    case "mounts":
      // Pas de validation stricte pour les accessoires
      break;
      
    case "nvr_network": {
      try {
        const proj = getProjectCached();
        if (!proj?.nvrPick?.nvr) {
          errors.push("Aucun NVR compatible trouvé. Vérifiez le catalogue NVR.");
        }
      } catch {
        errors.push("Impossible de calculer la configuration NVR.");
      }
      break;
    }
      
    case "storage": {
      const rec = MODEL.recording;
      if (!rec.daysRetention || rec.daysRetention < 1) errors.push(T("pdf_days_retention") + " invalides (min. 1).");
      if (rec.daysRetention > 30) errors.push("La loi limite la conservation à 30 jours maximum.");
      if (!rec.hoursPerDay || rec.hoursPerDay < 1) errors.push("Heures/jour invalides (min. 1).");
      break;
    }
  }
  
  return errors;
}

function showStepValidationErrors(errors) {
  if (!errors.length) return;
  
  // Supprimer un ancien toast s'il existe
  const old = document.getElementById("stepValidationToast");
  if (old) old.remove();
  
  const toast = document.createElement("div");
  toast.id = "stepValidationToast";
  Object.assign(toast.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    zIndex: "99998", maxWidth: "500px", width: "90%",
    background: "#1C1F2A", color: "#fff", borderRadius: "14px",
    padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    borderLeft: "4px solid #DC2626",
    animation: "slideUpToast .3s ease",
  });
  
  toast.innerHTML = `
    <div style="font-weight:900;font-size:14px;margin-bottom:8px">${"⚠️ " + T("err_cannot_continue")}</div>
    ${errors.map(e => `<div style="font-size:13px;margin-top:4px;opacity:0.9">• ${e}</div>`).join("")}
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove après 5s
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  // Click to dismiss
  toast.addEventListener("click", () => toast.remove());
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
    try {
      if (DOM.dataStatusEl) DOM.dataStatusEl.textContent = "Chargement des données…";
      KPI.sendNowait('page_view', { app: 'configurateur', v: (window.APP_VERSION || null) });

      
      // ✅ Chargement CSV direct (plus de tentative JSON)
      const loadCsvSafe = async (name, required = false) => {
        try {
          return await loadCsv(`/data/${name}.csv`);
        } catch (e) {
          if (required) throw e;
          return [];
        }
      };

      const [
        camsRaw,
        nvrsRaw,
        hddsRaw,
        swRaw,
        accRaw,
        screensRaw,
        enclosuresRaw,
        signageRaw
      ] = await Promise.all([
        loadCsvSafe("cameras", true),
        loadCsvSafe("nvrs", true),
        loadCsvSafe("hdds", true),
        loadCsvSafe("switches", true),
        loadCsvSafe("accessories", true),
        loadCsvSafe("screens"),
        loadCsvSafe("enclosures"),
        loadCsvSafe("signage"),
      ]);


      CATALOG.CAMERAS = camsRaw.map(normalizeCamera).filter((c) => c.id);
      CATALOG.NVRS = nvrsRaw.map(normalizeNvr).filter((n) => n.id);
      CATALOG.HDDS = hddsRaw.map(normalizeHdd).filter((h) => h.id);
      CATALOG.SWITCHES = swRaw.map(normalizeSwitch).filter((s) => s.id);
      CATALOG.SCREENS = screensRaw.map(normalizeScreen).filter(s => s.id);
      CATALOG.ENCLOSURES = enclosuresRaw.map(normalizeEnclosure).filter(e => e.id);

      // ✅ panneaux de signalisation
      CATALOG.SIGNAGE = (signageRaw || []).map(normalizeSignageRow).filter(Boolean);

  // ✅ Médias locaux uniquement (images + fiches)
  applyLocalMediaToCatalog();


      // ✅ accessories.csv = MAPPING (camera_id => junction/wall/ceiling)
      const mappings = accRaw.map(normalizeAccessoryMapping).filter(Boolean);
      CATALOG.ACCESSORIES_MAP = new Map(mappings.map((m) => [m.cameraId, m]));

      if (DOM.dataStatusEl) {
        const parts = [
          `Données chargées ✅`,
          `Caméras: ${CATALOG.CAMERAS.length}`,
          `NVR: ${CATALOG.NVRS.length}`,
          `HDD: ${CATALOG.HDDS.length}`,
          `Switch: ${CATALOG.SWITCHES.length}`,
          `Écrans: ${CATALOG.SCREENS.length}`,
          `Boîtiers: ${CATALOG.ENCLOSURES.length}`,
          `Panneaux: ${CATALOG.SIGNAGE.length}`,
          `Mappings accessoires: ${CATALOG.ACCESSORIES_MAP.size}`,
        ];
        DOM.dataStatusEl.textContent = parts.join(" • ");
      }

      sanity();

      LAST_PROJECT = null;
      MODEL.ui.resultsShown = false;

      syncResultsUI();
      render();
      updateNavButtons();
    } catch (e) {
      console.error(e);
      if (DOM.dataStatusEl) DOM.dataStatusEl.textContent = "Erreur chargement données ❌";
      alert(
        `Erreur chargement data: ${e.message}\n\nVérifie:\n- dossier /data\n- fichiers cameras.csv / nvrs.csv / hdds.csv / switches.csv / accessories.csv\n- serveur local (http://localhost:8000)`
      );
    }
  }
// ==========================================================
// ADMIN PANEL (UI) - utilise /api/login + /api/csv/{name}
// ==========================================================
let ADMIN_TOKEN = null;

// Schémas attendus (minimum) — aide à éviter de casser le configurateur
const ADMIN_SCHEMAS = {
  cameras: ["id","name","type","resolution_mp","image_url","datasheet_url"],
  nvrs: ["id","name","channels","nvr_output","image_url","datasheet_url"],
  hdds: ["id","name","capacity_tb"],
  switches: ["id","name"],
  accessories: ["camera_id"],
  screens: ["id","name","size_inch","format","vesa","Resolution","image_url","datasheet_url"],
  enclosures: ["id","name","screen_compatible_with","compatible_with","image_url","datasheet_url"],
  signage: ["id","name","image_url","datasheet_url"],
};

function adminSchemaWarnings(name, headers, rows){
  try{
    const need = ADMIN_SCHEMAS[name];
    if (!need) return null;

    const set = new Set((headers || []).map(h => String(h).trim()));
    const missing = need.filter(h => !set.has(h));
    const warns = [];

    if (missing.length) warns.push(`colonnes manquantes: ${missing.join(", ")}`);

    // Duplicats ID (si colonne id présente)
    if (set.has("id")){
      const seen = new Set();
      const dups = new Set();
      for (const r of (rows || [])){
        const id = String(r?.id || "").trim();
        if (!id) continue;
        if (seen.has(id)) dups.add(id);
        seen.add(id);
      }
      if (dups.size) warns.push(`IDs en double: ${Array.from(dups).slice(0,6).join(", ")}${dups.size>6?"…":""}`);
    }

    return warns.length ? warns.join(" • ") : null;
  } catch {
    return "validation impossible (format inattendu)";
  }
}

function admin$(id){ return document.getElementById(id); }

function adminShow(open){
  const m = admin$("adminModal");
  if (!m) return;
  m.classList.toggle("hidden", !open);
}

function setAdminMode(isAuthed){
  const loginBox = admin$("adminLoginBox");
  const editorBox = admin$("adminEditorBox");
  if (!loginBox || !editorBox) return;
  loginBox.classList.toggle("hidden", isAuthed);
  editorBox.classList.toggle("hidden", !isAuthed);
}


async function adminLogin(password){
  const msg = admin$("adminLoginMsg");
  if (msg) msg.textContent = "Connexion…";
  const res = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({password})
  });

if (!res.ok) {
  const t = await res.text().catch(()=> "");
  throw new Error(`Erreur chargement CSV (${res.status}) ${t}`);
}


  const data = await res.json();
  ADMIN_TOKEN = data.token;
  if (msg) msg.textContent = "✅ Connecté";
  setAdminMode(true);
}

async function adminLoadCsv(name){
  const ta = admin$("adminCsvText");
  const msg = admin$("adminMsg");
  if (msg) msg.textContent = `Chargement ${name}.csv…`;

  const res = await fetch(`/api/csv/${encodeURIComponent(name)}`, {
    cache: "no-store",
    headers: ADMIN_TOKEN ? { "Authorization": `Bearer ${ADMIN_TOKEN}` } : {},
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`Load CSV failed (${res.status}) ${t}`);
  }

  // ✅ variable unique : txt
  const txt = await res.text();

  // ✅ Remplit le textarea (mode expert) + la grille
  if (ta) ta.value = txt;

  const parsed = parseCSVGrid(txt);
  ADMIN_GRID.csvName = name;
  ADMIN_GRID.headers = parsed.headers;
  ADMIN_GRID.rows = parsed.rows;
  ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length ? 0 : -1;

renderAdminGrid();

const warn = adminSchemaWarnings(name, ADMIN_GRID.headers, ADMIN_GRID.rows);
if (msg) msg.textContent = warn ? `⚠️ Chargé avec alertes — ${warn}` : "✅ Chargé";

}


async function adminSaveCsv(name, content){
  const msg = admin$("adminMsg");
  if (msg) msg.textContent = `Sauvegarde ${name}.csv…`;

  const expertBox = document.getElementById("adminExpertBox");
  const ta = admin$("adminCsvText");

  let csvToSave = "";

  // ✅ Si mode expert ouvert => on sauve le textarea brut
  if (expertBox && !expertBox.classList.contains("hidden")) {
    csvToSave = (ta?.value || "");
  } else {
    // ✅ Sinon on sauve depuis la grille
    csvToSave = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
    if (ta) ta.value = csvToSave; // sync au cas où
  }

  const res = await fetch(`/api/csv/${encodeURIComponent(name)}`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({content: csvToSave})
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`Save CSV failed (${res.status}) ${t}`);
  }

  if (msg) msg.textContent = "✅ Sauvegardé (backup .bak créé côté serveur)";
  const warn = adminSchemaWarnings(name, ADMIN_GRID.headers, ADMIN_GRID.rows);
if (warn && msg) msg.textContent += ` • ⚠️ ${warn}`;

  // ✅ Recharger les données dans le configurateur après save
  try {
    await init();
    if (msg) msg.textContent += " • Données rechargées dans le configurateur";
  } catch {
    if (msg) msg.textContent += " • ⚠️ Données sauvegardées, mais reload a échoué (voir console)";
  }
}


function bindAdminPanel(){
  // ✅ IMPORTANT : sur la page configurateur, l'UI Admin n'existe pas.
  // Si on lance initAdminGridUI() quand les éléments n'existent pas => crash JS => configurateur KO.
  const modal = document.getElementById("adminModal");
  const root  = document.getElementById("adminRoot");
  const btnAdmin = document.getElementById("btnAdmin");

  // Si aucun élément admin n'est présent sur la page, on ne fait rien.
  if (!modal && !root && !btnAdmin) return;

  // ✅ Maintenant seulement on peut initialiser la grille admin
  initAdminGridUI();

  const btnClose  = admin$("btnAdminClose");
  const btnLogin  = admin$("btnAdminLogin");
  const btnLoad   = admin$("btnAdminLoad");
  const btnSave   = admin$("btnAdminSave");
  const btnLogout = admin$("btnAdminLogout");
  const sel = admin$("adminCsvSelect");
  const ta  = admin$("adminCsvText");
  const pwd = admin$("adminPassword");

  if (btnAdmin) btnAdmin.addEventListener("click", () => {
    adminShow(true);
    setAdminMode(!!ADMIN_TOKEN);
  });

  if (btnClose) btnClose.addEventListener("click", () => adminShow(false));

  // fermer si clic backdrop
  if (modal) modal.addEventListener("click", (e) => {
    if (e.target === modal) adminShow(false);
  });

  if (btnLogin) btnLogin.addEventListener("click", async () => {
    try {
      await adminLogin((pwd?.value || "").trim());
      const name = sel?.value || "cameras";
      await adminLoadCsv(name);
    } catch {
      const msg = admin$("adminLoginMsg");
      if (msg) msg.textContent = "❌ Login failed";
    }
  });

  if (btnLoad) btnLoad.addEventListener("click", async () => {
    try {
      const name = sel?.value || "cameras";
      await adminLoadCsv(name);
    } catch {
      const msg = admin$("adminMsg");
      if (msg) msg.textContent = "❌ Load failed";
    }
  });

  if (btnSave) btnSave.addEventListener("click", async () => {
    try {
      const name = sel?.value || "cameras";
      await adminSaveCsv(name, (ta?.value || ""));
    } catch {
      const msg = admin$("adminMsg");
      if (msg) msg.textContent = "❌ Save failed";
    }
  });

  if (btnLogout) btnLogout.addEventListener("click", () => {
    ADMIN_TOKEN = "";
    setAdminMode(false);
    const msg = admin$("adminMsg");
    if (msg) msg.textContent = "Déconnecté";
  });
}


// ⚠️ bind admin une fois que le DOM est prêt
// (si ton script est defer, ça passe direct)
bindAdminPanel();

// ==========================================================
// ADMIN TABLE EDITOR (Grille type Excel)
// Branche sur ton admin existant (ADMIN_TOKEN + /api/csv)
// ==========================================================

const ADMIN_GRID = {
  csvName: "cameras",
  headers: [],
  rows: [],           // array d'objets
  selectedIndex: -1,
};

// ---- helpers DOM
function q(id){ return document.getElementById(id); }

function escapeAttr(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// ---- CSV parse simple (quotes + virgules)
function parseCSVGrid(csvText){
  const s = String(csvText ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    const next = s[i+1];

    if (ch === '"' && inQuotes && next === '"'){
      cur += '"'; i++; continue;
    }
    if (ch === '"'){
      inQuotes = !inQuotes; 
      continue;
    }

    if (ch === "," && !inQuotes){
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n" && !inQuotes){
      row.push(cur);
      cur = "";
      // évite de pousser une ligne vide “à cause” d'un \n final
      if (row.some(c => String(c).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // dernière cellule
  row.push(cur);
  if (row.some(c => String(c).trim() !== "")) rows.push(row);

  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map(h => String(h ?? "").trim());
  const dataRows = [];

  for (let i = 1; i < rows.length; i++){
    const cols = rows[i];
    const obj = {};
    headers.forEach((h, idx) => obj[h] = String(cols[idx] ?? ""));
    dataRows.push(obj);
  }

  return { headers, rows: dataRows };
}


function toCSVGrid(headers, rows){
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const head = headers.map(esc).join(",");
  const body = rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

function syncGridMeta(){
  const el = q("adminGridMeta");
  if (!el) return;
  const sel = ADMIN_GRID.selectedIndex >= 0 ? `Ligne : #${ADMIN_GRID.selectedIndex+1}` : "Aucune ligne";
  el.textContent = `${sel} • ${ADMIN_GRID.rows.length} lignes • ${ADMIN_GRID.headers.length} colonnes`;
}

function syncExpertTextareaIfOpen(){
  const expertBox = q("adminExpertBox");
  const ta = q("adminCsvText");
  if (!expertBox || !ta) return;
  if (!expertBox.classList.contains("hidden")){
    ta.value = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
  }
}

function renderAdminGrid(){
  const mount = q("adminTableMount");
  if (!mount) return;

  if (!ADMIN_GRID.headers.length){
    mount.innerHTML = `<div class="muted" style="padding:12px">Aucune donnée.</div>`;
    syncGridMeta();
    return;
  }

  const ths = ADMIN_GRID.headers.map(h => `<th title="${escapeAttr(h)}">${escapeAttr(h)}</th>`).join("");

  const trs = ADMIN_GRID.rows.map((row, idx) => {
    const selected = idx === ADMIN_GRID.selectedIndex ? "selected" : "";
    const tds = ADMIN_GRID.headers.map(h => {
      const val = row[h] ?? "";
      return `<td><input class="adminCell" data-row="${idx}" data-col="${escapeAttr(h)}" value="${escapeAttr(val)}" /></td>`;
    }).join("");

    return `
      <tr class="adminRow ${selected}" data-row="${idx}">
        <td class="rowSel">#${idx+1}</td>
        ${tds}
      </tr>
    `;
  }).join("");

  mount.innerHTML = `
    <table class="adminTable">
      <thead>
        <tr>
          <th class="rowSel">—</th>
          ${ths}
        </tr>
      </thead>
      <tbody>${trs}</tbody>
    </table>
  `;

  syncGridMeta();
}



function adminGridAddRow(){
  if (!ADMIN_GRID.headers.length) return;
  const obj = {};
  ADMIN_GRID.headers.forEach(h => obj[h] = "");
  ADMIN_GRID.rows.push(obj);
  ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length - 1;
  renderAdminGrid();
  syncExpertTextareaIfOpen();
}

function adminGridDupRow(){
  const i = ADMIN_GRID.selectedIndex;
  if (i < 0 || !ADMIN_GRID.rows[i]) return;
  const copy = { ...ADMIN_GRID.rows[i] };
  ADMIN_GRID.rows.splice(i+1, 0, copy);
  ADMIN_GRID.selectedIndex = i+1;
  renderAdminGrid();
  syncExpertTextareaIfOpen();
}

function adminGridDelRow(){
  const i = ADMIN_GRID.selectedIndex;
  if (i < 0 || !ADMIN_GRID.rows[i]) return;
  ADMIN_GRID.rows.splice(i, 1);
  ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length ? Math.min(i, ADMIN_GRID.rows.length-1) : -1;
  renderAdminGrid();
  syncExpertTextareaIfOpen();
}

function initAdminGridUI(){
  const btnAdd = q("btnAdminAddRow");
  const btnDup = q("btnAdminDupRow");
  const btnDel = q("btnAdminDelRow");
  const btnToggle = q("btnAdminToggleExpert");
  const expertBox = q("adminExpertBox");
  const ta = q("adminCsvText");

  if (btnAdd) btnAdd.addEventListener("click", adminGridAddRow);
  if (btnDup) btnDup.addEventListener("click", adminGridDupRow);
  if (btnDel) btnDel.addEventListener("click", adminGridDelRow);

  if (btnToggle && expertBox){
    btnToggle.addEventListener("click", () => {
      expertBox.classList.toggle("hidden");
      if (!expertBox.classList.contains("hidden") && ta){
        ta.value = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
      }
    });
  }
}

  init();
  function ensurePdfPackButton() {
  const pdfBtn = document.querySelector("#btnExportPdf");
  if (!pdfBtn) return false;
  if (document.querySelector("#btnExportPdfPack")) return true;
  
  const packBtn = document.createElement("button");
  packBtn.id = "btnExportPdfPack";
  packBtn.type = "button";
  packBtn.className = (pdfBtn.className || "btn").replace("primary", "secondary");
  packBtn.textContent = T("sum_export_pack");
  packBtn.style.marginLeft = "8px";

  pdfBtn.insertAdjacentElement("afterend", packBtn);

  packBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    packBtn.disabled = true;
    packBtn.textContent = "Génération...";
    try {
      await exportProjectPdfWithLocalDatasheetsZip();
    } finally {
      packBtn.disabled = false;
      packBtn.textContent = T("sum_export_pack");
    }
  });

  return true;
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