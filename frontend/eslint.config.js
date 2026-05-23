// ============================================================
// ESLint flat config (v9+) — Configurateur Comelit
// ============================================================
//
// Règles : recommandées + assouplies pour ce projet (legacy JS).
// On évite les règles trop strictes qui imposeraient un gros
// refactor immédiat (no-var, prefer-const). On les activera
// progressivement à mesure que le code est modulariser.
// ============================================================

export default [
  {
    files: ['src/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        location: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        Image: 'readonly',
        CSS: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        Node: 'readonly',

        // App globals (à supprimer au fil du refactor modulaire)
        T: 'readonly',
        setLang: 'readonly',
        TRANSLATIONS: 'readonly',
        KPI: 'readonly',
        kpi: 'readonly',
        MODEL: 'readonly',
        CATALOG: 'readonly',
        CONFIG: 'readonly',
        DOM: 'readonly',

        // Libs externes (chargées via CDN dans index.html)
        html2canvas: 'readonly',
        jspdf: 'readonly',
        jsPDF: 'readonly',
      },
    },
    rules: {
      // ─── ERREURS RÉELLES (bloquantes) ───────────────────
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-redeclare': 'error',
      'no-unused-private-class-members': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',

      // ─── WARNINGS (à corriger progressivement) ──────────
      'no-unused-vars': [
        'warn',
        {
          args: 'none', // ignorer args non utilisés (utile pour callbacks)
          varsIgnorePattern: '^_', // _foo non lu = OK
          ignoreRestSiblings: true,
        },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off', // legacy : on garde console.log pour l'instant
      'no-prototype-builtins': 'warn',
      eqeqeq: ['warn', 'smart'], // == vs === : on tolère == null

      // ─── DÉSACTIVÉES (trop intrusives sur le code existant) ──
      'no-undef': 'off', // legacy : trop de globals implicites pour l'instant
      'no-var': 'off',
      'prefer-const': 'off',
    },
  },
  // Tests : on assouplit encore plus
  {
    files: ['src/**/*.{test,spec}.{js,mjs}', 'src/__tests__/**'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  // Ignorer dist, node_modules, etc.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      'src/i18n.js', // gros fichier i18n, peu de logique
      'src/optimisations.css',
      'src/style.css',
    ],
  },
];
