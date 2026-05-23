// ============================================================
// Vitest configuration — Configurateur Vidéosurveillance Comelit
// ============================================================
//
// Environnement : happy-dom (light, plus rapide que jsdom)
// Globals      : on active describe/it/expect sans import explicite
// Coverage     : v8 (natif, plus rapide qu'istanbul)
//
// Scripts associés (package.json) :
//   npm test            → Lance les tests une fois (CI)
//   npm run test:watch  → Mode watch interactif
//   npm run test:ui     → UI Vitest dans le navigateur
//   npm run coverage    → Rapport de couverture
// ============================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Happy-dom est ~3x plus rapide que jsdom et suffit pour notre cas
    environment: 'happy-dom',

    // describe / it / expect disponibles globalement (style Jest)
    globals: true,

    // Pattern d'inclusion des tests
    include: [
      'src/__tests__/**/*.{test,spec}.{js,mjs}',
      'src/**/*.{test,spec}.{js,mjs}',
    ],

    // Patterns exclus
    exclude: [
      'node_modules/**',
      'dist/**',
      '.{idea,git,cache,output,temp}/**',
    ],

    // Setup file (mock window.T pour i18n, etc.)
    setupFiles: ['./src/__tests__/setup.js'],

    // Timeout par défaut
    testTimeout: 5000,

    // Reporter
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI ? './test-results/junit.xml' : undefined,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{js,mjs}'],
      exclude: [
        'src/**/*.{test,spec}.{js,mjs}',
        'src/__tests__/**',
        'src/main.js', // bootstrap, peu testable unitairement
      ],
      // Seuils minimums (ajustables à mesure que les tests grossissent)
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },

    // Snapshot config
    snapshotFormat: {
      printBasicPrototype: false,
      escapeString: false,
    },
  },
});
