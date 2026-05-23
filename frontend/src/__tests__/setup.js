// ============================================================
// Test setup — globals & mocks
// ============================================================
//
// Ce fichier est exécuté avant chaque test (cf. vitest.config.js
// setupFiles). Il prépare l'environnement pour que les fonctions
// du code app.js puissent tourner sans erreur (notamment window.T
// pour i18n et les helpers DOM).
// ============================================================

import { vi } from 'vitest';

// ─── i18n mock ──────────────────────────────────────────────
// Renvoie la clé telle quelle par défaut. Les tests qui ont besoin
// de tester l'i18n réelle peuvent surcharger via vi.mock("./i18n.js").
globalThis.window = globalThis.window || globalThis;
globalThis.window.T = globalThis.window.T || ((key) => String(key));

// ─── KPI mock ───────────────────────────────────────────────
// Évite les erreurs "KPI is not defined" lors de l'import des
// fonctions qui font des appels KPI.sendNowait(...).
globalThis.window.KPI = globalThis.window.KPI || {
  send: vi.fn(),
  sendNowait: vi.fn(),
  snapshot: vi.fn(() => ({})),
};
globalThis.window.kpi = globalThis.window.kpi || vi.fn();

// ─── localStorage mock (happy-dom le fournit, mais on s'assure) ─
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// ─── Helpers utiles pour les tests ──────────────────────────
// Réinitialise tous les mocks entre chaque test
import { afterEach } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
});
