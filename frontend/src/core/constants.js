// ============================================================
// core/constants.js — Constantes centralisées
// ============================================================
//
// Source unique de vérité pour les couleurs, limites métier,
// paramètres par défaut et chemins. Extrait de app.js (Phase 1).
//
// Les labels traduits (scoring.levels) sont des GETTERS lazy
// pour s'assurer que T() (i18n) est disponible au moment de
// la lecture, pas au moment de l'import.
// ============================================================

/**
 * Identité visuelle Comelit (pour le PDF + en-têtes).
 */
export const COMELIT = Object.freeze({
  GREEN: '#00BF6F',
  BLUE: '#1C1F2A',
  WHITE: '#FFFFFF',
  TITLE_FONT: '"Arial Black", Arial, sans-serif',
  TEXT_FONT: 'Arial, sans-serif',
});

/**
 * Palette de couleurs réutilisée dans l'app (statuts, badges, etc.).
 */
export const COLORS = Object.freeze({
  green: '#00BC70',
  blue: '#1C1F2A',
  danger: '#DC2626',
  warn: '#F59E0B',
  muted: '#6B7280',

  // Fonds "tintés" (lisibles)
  okBg: 'rgba(0,188,112,.12)',
  warnBg: 'rgba(245,158,11,.12)',
  dangerBg: 'rgba(220,38,38,.10)',

  // Bordures
  okBorder: 'rgba(0,188,112,.35)',
  warnBorder: 'rgba(245,158,11,.35)',
  dangerBorder: 'rgba(220,38,38,.35)',
});

/**
 * Limites métier et seuils légaux/UX.
 */
export const LIMITS = Object.freeze({
  // Stockage / enregistrement
  maxRetentionDays: 30, // Max légal CNIL
  maxHoursPerDay: 24,
  maxFps: 30,

  // Valeurs par défaut
  defaultFps: 25,
  defaultRetentionDays: 14,
  defaultOverheadPct: 20,
  defaultReservePortsPct: 10,

  // Bornes de saisie utilisateur
  maxProjectNameLength: 80,
  maxBlockLabelLength: 60,
  maxQty: 999,
  maxScreenQty: 20,
  maxEnclosureQty: 10,
  maxSignageQty: 20,

  // PoE / réseau
  minPoeCamerasForSwitch: 16,

  // Partage / QR code
  shareUrlMaxChars: 4000,
  qrMaxChars: 4000,
});

/**
 * Options de configuration enregistrement.
 */
export const RECORDING_OPTIONS = Object.freeze({
  codecs: ['h265', 'h264'],
  fpsOptions: [10, 12, 15, 20, 25],
  screenSizes: [18, 22, 27, 32, 43, 55],
});

/**
 * Chemins médias locaux (relatifs à la racine du serveur).
 */
export const PATHS = Object.freeze({
  imgRoot: '/data/Images',
  pdfRoot: '/data/fiche_tech',
  dataDir: '/data',
});

/**
 * Niveaux de scoring caméra avec labels i18n.
 *
 * Les labels sont en GETTERS pour être évalués au moment de
 * l'accès (et donc utiliser la langue courante). Ainsi, si
 * l'utilisateur change de langue à chaud, les labels suivent.
 */
export const SCORING_LEVELS = Object.freeze({
  get ok() {
    return {
      icon: '✅',
      label: (typeof window !== 'undefined' && window.T?.('cam_recommended')) || 'Recommandée',
      color: COLORS.green,
      bg: COLORS.okBg,
    };
  },
  get warn() {
    return {
      icon: '⚠️',
      label: (typeof window !== 'undefined' && window.T?.('cam_acceptable')) || 'Acceptable',
      color: COLORS.warn,
      bg: COLORS.warnBg,
    };
  },
  get bad() {
    return {
      icon: '❌',
      label: (typeof window !== 'undefined' && window.T?.('cam_not_adapted')) || 'Non adaptée',
      color: COLORS.danger,
      bg: COLORS.dangerBg,
    };
  },
});

/**
 * Objet CONFIG agrégé — façade rétro-compatible avec l'ancien usage.
 * @deprecated Préférer les exports individuels (COLORS, LIMITS, etc.).
 */
export const CONFIG = Object.freeze({
  colors: COLORS,
  limits: LIMITS,
  codecs: RECORDING_OPTIONS.codecs,
  fpsOptions: RECORDING_OPTIONS.fpsOptions,
  screenSizes: RECORDING_OPTIONS.screenSizes,
  scoring: { levels: SCORING_LEVELS },
  paths: PATHS,
});
