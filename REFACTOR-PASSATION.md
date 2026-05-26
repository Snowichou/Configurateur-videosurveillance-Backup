# Refactor configurateur — Récap & TODO prochaine session

> Document de passation. Objectif global rappelé par Seb :
> **« On commence par la dette technique, je veux que le code soit impeccable. »**
> Décomposition du monolithe `frontend/src/app.js` (~13 000 lignes, IIFE, sans tests)
> en modules ESM purs et testés, avec injection de dépendances.

---

## 1. État actuel

| Indicateur | Valeur |
|---|---|
| `app.js` | **1 063 lignes** (était 13 000 à l'origine) |
| Modules ESM extraits | **55** (utils, engine, catalog, state, render, handlers, ui) |
| Tests Vitest | **20 fichiers — 216 tests — tous au vert** |
| Build Vite | ✓ (314 modules transformés) |
| Shims `window.xxx` dans modules purs | **0** — supprimés depuis PH9b |
| Branche | `main` — tout commité |

### Architecture

`app.js` est un **orchestrateur ESM pur** :
- 85 imports statiques en tête (dont ~20 aliasés `_fn` pour éviter collision avec wrappers locaux)
- Objet `DEPS` central avec getters live (`MODEL`, `CATALOG`, sous-collections) + ~25 symboles hoistés
- Tous les render wrappers utilisent `{ ...DEPS, <unique par appel> }`
- Thin wrappers locaux closent sur l'état et délèguent aux fonctions pures
- 4 `window._xxx` maintenus pour `optimisations.js` uniquement

### Modules extraits (`frontend/src/`)

- **utils/** — `format.js`, `csv.js`, `share.js`, `helpers.js`
- **core/** — `constants.js`
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
c64e249  PH16   DEPS étendu : getProjectCached + kpiConfigSnapshot/camPickCardHTML/validateStep → DEPS (1074→1063L)
5e7f8b4  PH15   Nettoyage stale comments, init() shorthand, collectDatasheetUrls → DEPS (1132→1074L)
2d23a0e  PH14   T/getCurrentLang ESM import, constants dedup, DEPS render wrappers (1243→1132L)
7bb257c  PH13   i18n exports ESM, DEPS central, main.js callback nettoyé (1248→1243L)
2265746  PH12   main.js : 51 imports redondants supprimés (260→207L)
63bdf35  PH11   Nettoyage structurel app.js : headers, indentation, blank lines (1309→1248L)
20252b3  PH10   format.js dédoublonnage dans app.js + dead code (1407→1309L)
9868b84  PH9b   Purge window.xxx shims dans 6 modules purs (~43 shims)
ea9ffd7  PH9a   scoring.js : imports ESM directs dans app.js
5a6844c  PH8    Smoke test : fix TDZ + 4 bugs runtime
dab87f6  PH7    Nettoyage app.js dead code/stale comments (1447→1412L)
ddbb896  PH6.5  Remplacer shims window._xxx par imports ESM (55 imports, ~80 shims)
```

---

## 2. ⚠️ Pièges d'environnement — À LIRE avant de reprendre

### 2.1 Git : verrou Windows bloque `git commit`

Le montage Windows interdit `unlink` côté sandbox Linux → `.git/index.lock` orphelin.

**Contournement** (à réutiliser systématiquement) :

```bash
cd configurateur-videosurveillance/   # PAS frontend/
export GIT_INDEX_FILE=/tmp/gitidx_<phase>
git read-tree HEAD
git add <fichiers...>
TREE=$(git write-tree)
COMMIT=$(git commit-tree $TREE -p HEAD -F /tmp/msg.txt)
echo "$COMMIT" > .git/refs/heads/main
```

Les warnings `unable to unlink .git/objects/.../tmp_obj_*` sont **inoffensifs**.

### 2.2 Écriture de fichiers → Python uniquement

Les outils Edit/Write peuvent laisser des octets null. Toujours :

```python
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
```

Vérifier l'absence de null bytes : `data.count(b'\x00') == 0`.

### 2.3 ⛔ Ne JAMAIS compter les accolades

Un script Python qui comptait les `{}` a détruit 138 Ko de `app.js`.
Utiliser `str.replace()` / `re.sub()` sur des **chaînes exactes** ; ou l'AST `espree` pour localiser.

### 2.4 Build Vite + tests

```bash
# Build (outDir hors du dossier monté Windows)
cd frontend && npx vite build --outDir /tmp/dist-phXX

# Tests (un seul appel suffit maintenant, timeout 40s)
timeout 40 node node_modules/vitest/dist/cli.js run
```

### 2.5 Smoke test Playwright

```python
from playwright.sync_api import sync_playwright
# Firefox déjà installé dans la sandbox
with sync_playwright() as p:
    browser = p.firefox.launch(headless=True)
    page = browser.new_page()
    # Servir /tmp/dist-phXX avec python3 -m http.server 5200 &
    page.goto("http://localhost:5200", timeout=15000)
    page.wait_for_selector("#steps", timeout=10000)
    # Vérifier : pas de ReferenceError / TypeError dans les erreurs
```

### 2.6 Patterns ESM (rappel)

```js
// Module pur — export nommé, pas de window.xxx
export function createXxxHandlers(deps = {}) { ... }

// app.js — import aliasé pour éviter collision avec wrapper local
import { scoreCameraForBlock as _scoreCameraForBlock } from './engine/camera-score.js';

// Wrapper local — close sur DEPS
function scoreCameraForBlock(block, cam) {
  return _scoreCameraForBlock(block, cam, DEPS);
}
```

### 2.7 Objet DEPS — structure actuelle

```js
const DEPS = {
  // Getters live (MODEL/CATALOG peuvent être mutés après init)
  get MODEL()        { return MODEL; },
  get CATALOG()      { return CATALOG; },
  get cameraLines()  { return MODEL.cameraLines; },
  get cameraBlocks() { return MODEL.cameraBlocks; },
  get cameras()      { return CATALOG.CAMERAS; },
  get catalogNvrs()  { return CATALOG.NVRS; },
  get catalogHdds()  { return CATALOG.HDDS; },
  get getCameraById()       { return getCameraById; },
  get canRecommendBlock()   { return canRecommendBlock; },   // const post-DEPS
  get buildRecoForBlock()   { return buildRecoForBlock; },   // const post-DEPS
  // Valeurs directes (fn déclarations hoistées ou imports)
  T, CLR,
  clamp, clampInt, clampNum, toNum, safeHtml,
  getDoriForObjective, normalizeEmplacement, getMpFromCam, getIrFromCam,
  getCameraProfile, objectiveLabel, accessoryTypeLabel, objectiveToDoriKey,
  translateUseCase, getAllUseCases, localizedDatasheetUrl,
  sanitizeFilename, dedupByUrl,
  getProjectCached,
  getThumbSrc,
  interpretScoreForBlock, computeCriticalProjectScore,
  generateQRDataUrl, generateShareUrl,
  getSelectedOrRecommendedEnclosure, getSelectedOrRecommendedScreen,
  getSelectedOrRecommendedSign, camPickCardHTML,
};
```

---

## 3. Journal des phases (PH7 → PH16)

### ✅ PH7 — Nettoyage dead code (1447→1412L)

- Suppression `badgePill`, stale comments `via window._createRenderPipeline`,
  wrapper `applyLocalMediaToCatalog`, lignes vides consécutives
- Commit `dab87f6`

### ✅ PH8 — Smoke test + 4 bugs runtime corrigés

| Bug | Fix |
|---|---|
| TDZ `CATALOG` dans `createLabelsHelpers` | Déplacer après `window._CATALOG = CATALOG` |
| `LOG is not defined` | `const LOG = console;` |
| `SAVE_KEY is not defined` | `const SAVE_KEY = 'comelit_cfg_save';` |
| `_SSO_USER is not defined` | → `window._SSO_USER` partout |
| `projectTipHtml is not defined` | Retirer (optionnel dans render/projet.js) |

Commits `5a6844c`, `9d3af53`

### ✅ PH9 — Suppression shims window.xxx dans modules purs

**PH9a** — scoring.js : 5 fonctions → imports ESM directs dans app.js  
**PH9b** — 6 fichiers : format.js, csv.js, normalize.js, constants.js, storage.js, app.js  
~43 shims supprimés. Commit `9868b84`

### ✅ PH10 — Dédoublonnage format.js dans app.js (1407→1309L, −98L)

- 5 définitions locales dupliquées de format.js supprimées
- Dead code supprimé : `$$`, semicolons orphelins, `window._getCameraById` doublon,
  25 commentaires `// ✅ Phase 2 —`, bloc `// BRANDING COMELIT`
- Commit `20252b3`

### ✅ PH11 — Nettoyage structurel app.js (1309→1248L, −61L)

- 6 commentaires `// ✅ Phase 3 —` supprimés
- 5 blocs section header orphelins supprimés
- 20 fonctions top-level : 2-space → colonne 0
- Blank lines : max 2
- Commit `63bdf35`

### ✅ PH12 — main.js : 51 imports redondants supprimés (260→207L, −53L)

- Hérités de l'époque `window.xxx = fn` — plus aucune utilité depuis PH9b
- Conservés : `./i18n.js`, `./chips-enhancer.js`, `./tooltip-fix.js`, `Auth`, html2pdf/canvas/jsPDF
- Commit `2265746`

### ✅ PH13 — i18n exports ESM + DEPS central (1248→1243L)

- **i18n.js** : 5 fonctions exportées (`T`, `setLang`, `getLangSelectorHtml`,
  `updateStepperLabels`, `updateNavButtons`) — 4 shims `window.xxx` supprimés
- **main.js** : import nommé i18n + callback `.then()` simplifié
- **app.js** : objet `DEPS` initial avec getters live (MODEL/CATALOG)
- Commit `7bb257c`

### ✅ PH14 — T/getCurrentLang ESM + constants + DEPS render (1243→1132L, −111L)

**PH14.1** — `i18n.js` : `window._currentLang` → `export function getCurrentLang()`.
`app.js` : import `{ T, getCurrentLang }` ; 2 usages `_currentLang` → `getCurrentLang()`.

**PH14.2** — `app.js` : 68L de `COLORS`+`CONFIG` locaux → `import { COLORS, CONFIG } from './core/constants.js'`.
`constants.js` utilise des lazy getters pour `scoring.levels` (i18n à chaud).

**PH14.3** — `DEPS` étendu (+9 symboles). Tous les render wrappers refactorisés en
`{ ...DEPS, <unique par appel> }`. `computeTotals` + `pickNvr` → DEPS.

Commit `2d23a0e`

### ✅ PH15 — Nettoyage stale comments + init() shorthand (1132→1074L, −58L)

**PH15.1** — Nettoyage section headers :
- Blocs 4A/4B (docs CSV format) supprimés
- Tous les headers 2/4-space-indentés → colonne 0
- Labels renumérotés (`0) HELPERS` → `HELPERS`, `8) ENGINE` ×3 → labels distincts…)
- Banners orphelins supprimés

**PH15.2** — `init()` : 9 paires `key: key` → shorthand JS. `sanitizeFilename` + `dedupByUrl`
ajoutés à DEPS. `collectDatasheetUrlsFromProject` → DEPS.

Commits `5e7f8b4`

### ✅ PH16 — DEPS étendu + 5 migrations (1074→1063L, −11L)

`getProjectCached` ajouté à DEPS (hoisted fn decl, ref directe sans getter).  
Migré vers DEPS : `kpiConfigSnapshot`, `camPickCardHTML`, `validateStep`,
`showStepValidationErrors`.

Commit `c64e249`

---

## 4. TODO prochaine session (PH17+)

### Priorité 1 — Migrer `optimisations.js` vers ESM

**Objectif** : supprimer les 4 derniers `window._xxx` d'`app.js` :
`window._MODEL`, `window._CATALOG`, `window._STEPS`, `window._getCameraById`.

**Blocant** : `optimisations.js` les lit via `window.*` en 8+ endroits et hook `window.render`.

**Plan** :
1. Convertir `optimisations.js` en module ESM avec une fonction `initOptimisations(deps)` :
   ```js
   // optimisations.js
   export function initOptimisations({ getModel, getCatalog, getSteps,
                                       getCameraById, render }) { ... }
   ```
2. Appeler `initOptimisations({ ... })` depuis `app.js` après `import("./optimisations.js")`
   dans `main.js` ou dans `init()`.
3. Supprimer les 4 assignments `window._xxx` dans `app.js`.
4. Supprimer `window.render` hook dans `optimisations.js` (passer `render` en dep).

**Attention** : `optimisations.js` utilise aussi `window.render` et `window.__optimHooked`
pour hooker le cycle de rendu — ces 2 window.xxx devront aussi être migrés ou explicitement
conservés (hook de cycle non extractable facilement).

---

### Priorité 2 — Extraire `computeProject()` en `engine/project.js` étendu

`computeProject()` dans app.js est un wrapper sur `computeProjectPure` qui passe un gros
objet de deps incluant `computeTotals, pickNvr, planPoESwitches, mbpsToTB, pickDisks,
getTotalCameras` — des fonctions locales non présentes dans DEPS.

**Option** : ajouter ces 6 fonctions à DEPS, puis `computeProject() → return computeProjectPure(DEPS)`.
Prérequis : vérifier que `computeProjectPure` accepte les clés supplémentaires sans crash.

---

### Priorité 3 — Nettoyage résiduel app.js

Éléments mineurs restants à traiter :

| Item | Description |
|---|---|
| `window.renderStepMounts` | Compat alias ligne ~601 — vérifier si encore utilisé par `optimisations.js`, sinon supprimer |
| `window.testPdfGeneration` | Debug helper — commenter ou supprimer |
| `// Dédup par URL` | Commentaire orphelin (code supprimé) ligne ~768 |
| `// Helper pour collecter les IDs produits` | Idem, orphelin |
| Section `// ADMIN PANEL` | Vérifier si `ADMIN_TOKEN` et `_adminRef` sont utilisés hors tests |
| Double blank lines | Quelques séquences 3+ lignes vides subsistent |

---

### Priorité 4 — Tests des render wrappers (couverture)

Les wrappers `renderStepXxx` dans app.js ne sont pas couverts par les tests unitaires.
Les fonctions pures importées ont des tests, mais pas les wrappers qui construisent
`{ ...DEPS, <unique> }`. Un test d'intégration minimal vérifierait que l'appel ne crashe pas.

---

### Priorité 5 (future) — Réduire `app.js` sous 1 000 lignes

Avec PH17 (optimisations.js) et PH18 (computeProject → DEPS), on atteindrait ~1 020L.
Pour passer sous 1 000 : extraire le bloc `createStepsHandlers` call (~30L) et le bloc
`createRenderPipeline` call (~15L) dans des fonctions dédiées dans `handlers/`.

---

## 5. Rappels de méthode

1. **Module pur + injection de dépendances** — wrapper `app.js` qui passe les deps
   → garantit zéro changement de comportement observable.
2. **Un fichier de tests Vitest par module pur** — comportement + edge cases.
3. **Vérif systématique** après chaque extraction :
   `npx vite build --outDir /tmp/dist-phXX` + `timeout 40 node node_modules/vitest/dist/cli.js run`
4. **Remplacements dans `app.js`** uniquement via Python `str.replace()` / `re.sub()`
   sur chaînes exactes — jamais via les outils Edit/Write du LLM.
5. **Git workaround** : voir §2.1 — `GIT_INDEX_FILE=/tmp/gitidx_xxx` à chaque commit.
6. **Smoke test** : Python + Playwright Firefox headless contre `/tmp/dist-phXX`
   servi par `python3 -m http.server 5200`.
7. **Apostrophes en strings JS** écrites depuis Python → utiliser double-quotes.
8. **Ordre des remplacements** dans app.js : traiter du plus haut offset vers le plus bas.
