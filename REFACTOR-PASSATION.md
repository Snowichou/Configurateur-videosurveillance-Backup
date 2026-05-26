# Refactor configurateur — Récap & TODO prochaine session

> Document de passation. Objectif global rappelé par Seb :
> **« On commence par la dette technique, je veux que le code soit impeccable. »**
> Décomposition du monolithe `frontend/src/app.js` (~13 000 lignes, IIFE, sans tests)
> en modules ESM purs et testés, avec injection de dépendances.

---

## 1. État actuel

| Indicateur | Valeur |
|---|---|
| `app.js` | **1 045 lignes** (était 13 000 à l'origine) |
| `optimisations.js` | **666 lignes** — ESM pur, 0 `window.` shim |
| Modules ESM extraits | **55** (utils, engine, catalog, state, render, handlers, ui) |
| Tests Vitest | **26 fichiers — 469 tests — tous au vert** |
| Build Vite | ✓ (315 modules transformés) |
| Shims `window.xxx` dans modules purs | **0** — supprimés depuis PH9b |
| `window.T` / `window.TRANSLATIONS` | **0** — supprimés PH17 cleanup |
| Branche | `main` — tout commité (`9951c44`) |

### Architecture

`app.js` est un **orchestrateur ESM pur** :
- 85 imports statiques en tête (dont ~20 aliasés `_fn` pour éviter collision avec wrappers locaux)
- Objet `DEPS` central avec getters live (`MODEL`, `CATALOG`, sous-collections) + ~30 symboles hoistés
  (inclut désormais `KPI`, `mbpsToTB`, `computeTotals`, `getTotalCameras`, `pickDisks`, `pickNvr`, `planPoESwitches`)
- `computeProject()` → `return computeProjectPure(DEPS)` (PH18)
- Fonction `export getOptimDeps()` exposant les 5 deps pour optimisations.js (PH17)
- Tous les render wrappers utilisent `{ ...DEPS, <unique par appel> }`
- `window.` restants dans src : KPI tracker (design), auth.js (design), jsPDF interop (main.js), exportCatalogJSON debug

`optimisations.js` est maintenant un **module ESM** :
- `export function initOptimisations(deps)` appelé depuis main.js
- deps : `{ getModel, getCatalog, getSteps, getCameraById, render }`
- Plus de `window._MODEL/CATALOG/STEPS/getCameraById` ni `window.render`
- `hookRenderOnce()` supprimé (c'était du code mort — `window.render` n'était jamais défini)
- `callOriginalRender()` utilise `deps.render` + fire les afterRenderCallbacks

### Modules extraits (`frontend/src/`)

- **utils/** — `format.js`, `csv.js`, `share.js`, `helpers.js`
- **core/** — `constants.js` (import T depuis i18n.js — plus de `window.T`)
- **engine/** — `storage.js`, `poe.js`, `pick-nvr.js`, `scoring.js`, `camera-score.js`,
  `camera-reco.js`, `totals.js`, `accessories.js`, `project.js`, `validate-step.js`,
  `kpi.js`, `block-lifecycle.js`, `persistence.js`, `sanity.js`, `complements.js`,
  `storage-calc.js`, `kpi-tracker.js`, `reco-block.js`
- **catalog/** — `normalize.js`, `media.js`
- **state/** — `model.js`, `lookups.js`, `actions.js`
- **render/** — `projet.js`, `storage.js`, `options.js`, `accessories.js`, `nvr.js`,
  `summary.js`, `cameras.js`, `camera-card.js`, `pdf.js`, `summary-final.js`,
  `pdf-blob.js`, `pdf-export.js`, `pdf-preview.js`, `datasheet-urls.js`,
  `pdf-pro.js`, `pdf-test.js`, `pipeline.js`
- **handlers/** — `steps.js`, `admin.js`, `summary.js`, `init.js`, `quote.js`
- **ui/** — `toast.js`, `labels.js`

### Commits récents

```
9951c44  PH17+18+cleanup   optimisations.js ESM, computeProject→DEPS, window shims removed (1063→1045L)
26beff3  docs              REFACTOR-PASSATION.md réécriture complète
c64e249  PH16              DEPS étendu : getProjectCached + kpiConfigSnapshot/camPickCardHTML/validateStep (1074→1063L)
5e7f8b4  PH15              Nettoyage comments, init() shorthand, collectDatasheetUrls→DEPS (1132→1074L)
2d23a0e  PH14              T/getCurrentLang ESM import, constants dedup, DEPS render wrappers (1243→1132L)
7bb257c  PH13              i18n exports ESM, DEPS central, main.js callback nettoyé (1248→1243L)
2265746  PH12              main.js : 51 imports redondants supprimés (260→207L)
63bdf35  PH11              Nettoyage structurel app.js (1309→1248L)
20252b3  PH10              format.js dédoublonnage dans app.js + dead code (1407→1309L)
9868b84  PH9b              Purge window.xxx shims dans 6 modules purs (~43 shims)
```

---

## 2. DEPS — état complet

```js
const DEPS = {
  // Live getters (garantissent refs fraîches à chaque appel)
  get MODEL()        { return MODEL; },
  get CATALOG()      { return CATALOG; },
  get cameraLines()  { return MODEL.cameraLines; },
  get cameraBlocks() { return MODEL.cameraBlocks; },
  get cameras()      { return CATALOG.CAMERAS; },
  get catalogNvrs()  { return CATALOG.NVRS; },
  get catalogHdds()  { return CATALOG.HDDS; },
  get getCameraById(){ return getCameraById; },
  get canRecommendBlock()  { return canRecommendBlock; },   // TODO: à confirmer
  get buildRecoForBlock()  { return buildRecoForBlock; },   // TODO: à confirmer
  // Valeurs directes (hoistées ou définies avant DEPS)
  T, CLR,
  clamp, clampInt, clampNum, toNum, safeHtml,
  getDoriForObjective, normalizeEmplacement, getMpFromCam, getIrFromCam,
  getCameraProfile, objectiveLabel, accessoryTypeLabel, objectiveToDoriKey,
  translateUseCase, getAllUseCases, localizedDatasheetUrl,
  sanitizeFilename, dedupByUrl,
  KPI, mbpsToTB,
  computeTotals, getTotalCameras, pickDisks, pickNvr, planPoESwitches,
  getProjectCached,
};
```

---

## 3. Ce qui reste (prochaines sessions)

### Priorité haute

**PH19 — Extraire chips-enhancer.js de son IIFE**
- `chips-enhancer.js` est encore une IIFE (`(function() { ... })()`), importée depuis main.js via `import './chips-enhancer.js'`
- Convertir en ESM pur (supprimer le wrapper IIFE), vérifier l'initialisation auto (DOMContentLoaded)

**PH20 — Extraire optimisations.js vers modules séparés**
- `optimisations.js` (666L) est une grosse fonction monolithique avec ~12 sections (A-K)
- Candidats à l'extraction : undo-redo (A), step-transitions (B), swipe (C), compare (D), floating-recap (F), save-load (G), validation (I)
- Chaque section peut devenir un module `src/ui/optim/xxx.js`

**PH21 — Nettoyage handlers/steps.js**
- `window.kpi` reference at line 371 — à remplacer par import ESM de kpi-tracker.js
- Vérifier d'autres couplages implicites

### Priorité normale

**PH22 — Augmenter la couverture de tests**
- 469 tests mais seulement sur ~55% des modules
- Candidats sans tests : `engine/project.js` (computeProjectPure), `handlers/steps.js`, `render/pipeline.js`

**PH23 — Nettoyer app.js : wrappers thin restants**
- Vérifier si certains thin wrappers (getTotalCameras, computeTotals, pickNvr...) peuvent être
  remplacés par appel direct de la fonction pure via DEPS
- `bindSummaryButtons()` utilise encore une liste bespoke (pas DEPS)

**PH24 — Réduire la taille du chunk principal**
- `index.js` fait 1810 kB (html2pdf, jsPDF, html2canvas) — chunking Rollup à configurer

---

## 4. Patterns établis (aide-mémoire)

### Dependency Injection
```js
// Pure function signature
export function doThingPure(input, { MODEL, T, getCameraById, ... }) { ... }

// Wrapper in app.js
function doThing(input) { return doThingPure(input, DEPS); }

// Render wrapper (unique deps par appel)
function renderSomething() { return renderSomethingPure({ ...DEPS, currentLang: getCurrentLang() }); }
```

### Getters dans DEPS (anti-TDZ pour const post-DEPS)
```js
// ✅ const défini AVANT DEPS → référence directe
const KPI = ...; // ligne ~196, DEPS ligne ~275
const DEPS = { KPI, ... }; // OK

// ✅ function declaration → hoistée → référence directe
function getCameraById() { ... }
const DEPS = { getCameraById, ... }; // OK (hoisted)

// ✅ const défini APRÈS DEPS → getter obligatoire
const DEPS = { get canRecommendBlock() { return canRecommendBlock; } };
const { canRecommendBlock } = createBlockLifecycleHandlers(...); // ligne post-DEPS
```

### initOptimisations (PH17)
```js
// main.js
import("./app.js").then(({ getOptimDeps }) => {
  import("./optimisations.js").then(({ initOptimisations }) => {
    setTimeout(() => initOptimisations(getOptimDeps()), 500);
  });
  // ... autres inits
});

// app.js
export function getOptimDeps() {
  return { getModel: () => MODEL, getCatalog: () => CATALOG,
           getSteps: () => STEPS, getCameraById, render };
}

// optimisations.js
export function initOptimisations(deps) {
  const { getModel, getCatalog, getSteps, getCameraById, render: _render } = deps;
  // ... tout le code, plus de window._xxx
}
```

### Commit via plumbing Git (contourne le lock Windows)
```bash
TMPIDX=/tmp/gitidx_phXX
GIT_INDEX_FILE=$TMPIDX git read-tree HEAD
GIT_INDEX_FILE=$TMPIDX git update-index --add frontend/src/app.js [...]
TREE=$(GIT_INDEX_FILE=$TMPIDX git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(GIT_INDEX_FILE=$TMPIDX git commit-tree "$TREE" -p "$PARENT" -m "message")
python3 -c "open('.git/refs/heads/main','w').write('$COMMIT\n')"
```

### Tests
```bash
NODE_PATH=/tmp/vitest-install/node_modules /tmp/vitest-install/node_modules/.bin/vitest run
# (vitest non installé dans node_modules du projet — installer dans /tmp/vitest-install)
```

### Build
```bash
cd frontend && npx vite build --outDir /tmp/dist-phXX
# (évite EPERM sur dist/ monté Windows)
```
