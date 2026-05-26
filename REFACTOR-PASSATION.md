# Refactor configurateur — Récap & TODO prochaine session

> Document de passation. Objectif global rappelé par Seb :
> **« On commence par la dette technique, je veux que le code soit impeccable. »**
> Décomposition du monolithe `frontend/src/app.js` (~13 000 lignes, IIFE, sans tests)
> en modules ESM purs et testés.

---

## 1. État actuel (fin de session)

| Indicateur | Valeur |
|---|---|
| `app.js` | **1 248 lignes** (était 13 000 à l'origine) |
| Modules ESM extraits | **55** |
| Tests Vitest | **17 fichiers** — tous au vert |
| Build Vite | OK (317 modules transformés) |
| Shims `window.xxx` dans modules purs | **0** — tous supprimés (PH9/PH9b) |
| Branche | `main` — tout est commité |

### Architecture actuelle

`app.js` est désormais un **vrai module ESM** :
- Pas de IIFE, pas de `window._xxx = fn` dans les modules
- 55 imports ESM directs en tête de `app.js` (dont 17 aliasés `_fn` pour éviter collision avec thin wrappers locaux)
- Les thin wrappers locaux closent sur l'état (`MODEL`, `CATALOG`, `T`…) et délèguent aux fonctions pures importées
- `optimisations.js` continue de lire `window._MODEL`, `window._CATALOG`, `window._STEPS`, `window._getCameraById` — ces 4 assignments sont conservés dans `app.js`

### Modules extraits (`frontend/src/`)

- **utils/** — `format.js`, `csv.js`, `share.js`, `helpers.js`
- **core/** — `constants.js`
- **engine/** — `storage.js`, `poe.js`, `pick-nvr.js`, `scoring.js`, `camera-score.js`, `camera-reco.js`, `totals.js`, `accessories.js`, `project.js`, `validate-step.js`, `kpi.js`, `block-lifecycle.js`, `persistence.js`, `sanity.js`, `complements.js`, `storage-calc.js`, `kpi-tracker.js`, `reco-block.js`
- **catalog/** — `normalize.js`, `media.js`
- **state/** — `model.js`, `lookups.js`, `actions.js`
- **render/** — `projet.js`, `storage.js`, `options.js`, `accessories.js`, `nvr.js`, `summary.js`, `cameras.js`, `camera-card.js`, `pdf.js`, `summary-final.js`, `pdf-blob.js`, `pdf-export.js`, `pdf-preview.js`, `datasheet-urls.js`, `pdf-pro.js`, `pdf-test.js`, `pipeline.js`
- **handlers/** — `steps.js`, `admin.js`, `summary.js`, `init.js`, `quote.js`
- **ui/** — `toast.js`, `labels.js`

### Commits récents

```
9868b84  PH9b   Purge window.xxx shims modules purs (format/csv/normalize/constants/storage) — ~43 shims supprimés
ea9ffd7  PH9    scoring.js : imports ESM directs (normalizeEmplacement, objectiveToDoriKey, …) — 1414→1406L
5a6844c  PH8    Smoke test : fix TDZ createLabelsHelpers + 4 vars non définies (LOG, SAVE_KEY, _SSO_USER, projectTipHtml)
dab87f6  PH7    Nettoyage app.js : dead code, stale comments, blank lines (1447→1412L)
ddbb896  PH6.5  Remplacer shims window._xxx par imports ESM directs (55 imports, 80 shims supprimés)
5b51fee  PH6.4  engine/reco-block.js (canRecommendBlock+buildRecoForBlock ~40L, 9 tests)
2d9b9ba  PH6.3  utils/helpers.js (sanitizeFilename+dedupByUrl ~30L, 10 tests)
7aa8647  PH6.2  suppression IIFE principale (module ESM scope)
a4efec4  PH6.1b KPI interne → kpi-tracker.js (compactCameras+snapshot, 155L)
(sessions précédentes : PH5, PH4.4a–f, PH3.3–3.8, etc.)
```

---

## 2. ⚠️ Pièges d'environnement — À LIRE avant de reprendre

### 2.1 Git : le verrou Windows bloque `git commit`

Le montage Windows interdit l'`unlink` côté sandbox Linux. Résultat : `.git/index.lock`
(et les locks de refs) deviennent **orphelins** et bloquent tout `git commit` normal.

**Contournement utilisé** (à réutiliser tel quel) — n'utilise aucun verrou :

```bash
cd <repo-root>   # configurateur-videosurveillance/ (PAS frontend/)
cp .git/index /tmp/gitidx_<phase>
export GIT_INDEX_FILE=/tmp/gitidx_<phase>
git add <fichiers...>
TREE=$(git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(printf '%s' "message" | git -c user.name="refactor" -c user.email="refactor@local" commit-tree "$TREE" -p "$PARENT")
printf '%s\n' "$COMMIT" > .git/refs/heads/main
printf '%s %s refactor <refactor@local> %s +0000\tcommit: msg\n' "$PARENT" "$COMMIT" "$(date +%s)" >> .git/logs/HEAD
cp /tmp/gitidx_<phase> .git/index
```

Les warnings `unable to unlink .git/objects/.../tmp_obj_*` sont **inoffensifs**.

### 2.2 Bug de padding null / cache de montage

- L'outil **Edit** et **Write** peuvent laisser des **octets null** en fin de fichier.
  Toujours écrire les fichiers de code via Python :
  ```python
  with open(path, 'w', encoding='utf-8', newline='\n') as f:
      f.write(content)
  ```
- Pour `main.js` : toujours restaurer depuis `git show HEAD:frontend/src/main.js`,
  ajouter le nouvel import, puis réécrire via Python.
- Vérifier l'absence de null bytes : `data.count(b'\x00')`.

### 2.3 ⛔ Ne JAMAIS compter les accolades

Un script Python qui comptait les `{}` a un jour **détruit 138 Ko de `app.js`**.
**Toujours** utiliser le parseur AST `espree` (déjà installé) pour localiser/remplacer :

```bash
NODE_PATH="$(pwd)/node_modules" node -e "
const espree = require('espree');
// parser → trouver FunctionDeclaration par nom → utiliser node.range
"
```

### 2.4 Décalage de range espree (±1 char)

`espree node.range[0]` peut pointer en plein milieu du mot `function`. **Toujours** vérifier :

```python
m = re.search(r'(async\s+)?function\s+NomDeLaFonction', src[range[0]-20:range[0]+50])
real_start = range[0] - 20 + m.start()
```

Et pour la fin, scanner en arrière depuis `range[1]` pour trouver le vrai `}` :

```python
pos = range[1] - 1
while src[pos] != '}': pos -= 1
real_end = pos + 1
```

**Exception** : les arrow functions/const one-liners (ex: `const toBool = (v) => ...;`) n'ont
pas de `}` final — utiliser directement `range[1]` (endpoint espree) pour ceux-ci.

### 2.5 Vérification build/tests

Build + suite complète dépassent le timeout de 45 s du bash → lancer en **deux appels séparés** :

```bash
# Pass 1 (engine + render-pdf)
node node_modules/vitest/vitest.mjs run src/__tests__/engine-*.test.js src/__tests__/render-pdf.test.js

# Pass 2 (render + state + utils + catalog + ui)
node node_modules/vitest/vitest.mjs run src/__tests__/catalog-*.test.js src/__tests__/render-{accessories,camera-card,cameras,nvr,options,projet,storage,summary}.test.js src/__tests__/state-*.test.js src/__tests__/utils-*.test.js src/__tests__/ui-labels.test.js
```

`vite build` vers `/tmp` : `--outDir /tmp/vite-phXXX --emptyOutDir`

### 2.6 Patterns de factory et import ESM (PH6.5 — plus de shims window._xxx)

Depuis PH6.5, les modules exportent directement et app.js importe :
```js
// Dans le module
export function createXxxHandlers(deps = {}) { ... }
// Plus de window._createXxxHandlers = ...

// Dans app.js
import { createXxxHandlers } from './handlers/xxx.js';
const { fn1, fn2 } = createXxxHandlers({ dep1, dep2 });
```

Pour les fonctions pures dont app.js a un wrapper local (closure sur deps) :
```js
// Import aliasé pour éviter collision avec le wrapper local
import { scoreCameraForBlock as _scoreCameraForBlock } from './engine/camera-score.js';

// Wrapper local dans app.js (close sur MODEL, CATALOG, T…)
function scoreCameraForBlock(block, cam) {
  return _scoreCameraForBlock(block, cam, { get CATALOG() {...}, ... });
}
```

Les 4 `window._xxx` maintenus sont réservés à `optimisations.js` :
`window._MODEL`, `window._CATALOG`, `window._STEPS`, `window._getCameraById`.

### 2.7 Apostrophes dans les strings JS écrits depuis Python

Les chaînes françaises avec apostrophes (`d'abord`, `l'app`...) dans du code JS single-quoted
cassent le parseur ESLint. **Toujours** utiliser des double-quotes pour ces chaînes :
```js
showToast("⚠️ Finalise ta configuration d'abord.", 'warn')
```

### 2.8 f-strings Python et backslash

Python < 3.12 interdit les backslash dans les expressions f-string :
```python
# INTERDIT en Python < 3.12 :
f"{value.count(b'\x00')}"
# CORRECT : stocker d'abord
null_count = value.count(b'\x00')
f"{null_count}"
```

### 2.9 Ordre des remplacements dans app.js

Quand on supprime/remplace plusieurs plages dans app.js au sein d'un même script Python,
**toujours traiter du plus haut offset vers le plus bas** pour éviter le décalage d'index.
Exemple :
```python
# Correct — highest first
src = src[:high_start] + replacement + src[high_end:]
src = src[:low_start]  + replacement + src[low_end:]
```

---

## 3. Ce qui reste dans `app.js` (1 414 lignes)

`app.js` est désormais un **vrai module ESM** : plus de IIFE, plus de `window._xxx` shims.
Il reste l'orchestrateur principal : état global, thin wrappers locaux, bootstrap.

### Thin wrappers locaux (pattern de clôture sur deps)

Chaque wrapper local close sur l'état (`MODEL`, `CATALOG`, `T`, `CLR`…)
et délègue à la fonction pure importée (aliasée `_fn`) :

```js
function scoreCameraForBlock(block, cam) {          // wrapper local
  return _scoreCameraForBlock(block, cam, { ... }); // fn pure importée
}
```

17 paires de ce type subsistent dans app.js. Le résoudre proprement nécessiterait soit :
- Passer les deps explicitement à chaque call site (refactor invasif), ou
- Extraire un objet `deps` central (ex: `makeDeps()`) injecté une seule fois.

### Fonctions résiduelles à logique réelle (non wrappers)

| Fonction | Lignes | Commentaire |
|---|---|---|
| `localizedDatasheetUrl` | 4 | Wrapper → `_localizedDatasheetUrl(url, _currentLang)` (ESM depuis normalize.js, PH9b) |
| `getProjectCached` | ~11 | Cache projet (dépend de `MODEL`) |
| `safeStr`, `clamp`, `clampNum` | ~15 | Micro-helpers locaux |
| État global + DOM | ~400 | `MODEL`, `CATALOG`, `STEPS`, `DOM`, `KPI`… |
| `window._MODEL/CATALOG/STEPS/getCameraById` | 4 assignments | Maintenus pour `optimisations.js` |

### ✅ PH7 — Fait (session courante)

- Suppression fonction arrow orpheline `badgePill` (lignes ~275)
- Correction 3 commentaires stale `via window._createRenderPipeline` → `via createRenderPipeline`
- Suppression wrapper `applyLocalMediaToCatalog` + inline en arrow dans deps de `initPure`
- Collapse des lignes vides consécutives (max 2) — 27 lignes supprimées
- Net : **1 447 → 1 412 lignes** (35 supprimées)
- Build ✓ (317 modules) · Tests ✓ (369 tests) · Commit `dab87f6`

### ✅ PH8 — Fait (session courante)

Smoke test via Playwright/Firefox contre le build prod — **4 bugs runtime détectés et corrigés** :

| Bug | Cause | Fix |
|---|---|---|
| TDZ `re` (= `CATALOG`) | `createLabelsHelpers` appelé ligne 262 mais `const CATALOG` à ligne 348 — vite fusionne en 1 `const` → TDZ | Déplacer l'appel après `window._CATALOG = CATALOG` + passer CATALOG directement (pas de getter) |
| `LOG is not defined` | Variable utilisée dans `createPersistenceHandlers` et catch block, jamais déclarée | Ajouter `const LOG = console;` |
| `SAVE_KEY is not defined` | Passé dans `initPure` mais jamais déclaré dans app.js | Ajouter `const SAVE_KEY = 'comelit_cfg_save';` |
| `_SSO_USER is not defined` | Bare identifier en ESM strict — `window._SSO_USER` n'est pas set sans backend | Remplacer par `window._SSO_USER` partout (property access = safe) |
| `projectTipHtml is not defined` | Passé dans deps de `_renderStepProject` mais jamais défini | Retirer (optionnel dans render/projet.js avec valeur par défaut `() => ''`) |

Résultat : **smoke test ✅ PASS** — aucune erreur JS réelle à l'initialisation.
Build ✓ (317 modules) · Tests ✓ (369 tests) · Commits `5a6844c`, `9d3af53`

### ✅ PH9 — Fait (session courante)

Suppression de **tous** les `window.xxx = fn` résiduels dans les modules purs.

**PH9a** (commit `ea9ffd7`) — scoring.js : 5 fonctions migrées en imports ESM directs dans app.js.

**PH9b** (commit `9868b84`) — purge globale sur 6 fichiers :

| Fichier | Shims supprimés | L avant → après |
|---|---|---|
| `utils/format.js` | safeHtml, isFalseLike, toBool, toStrOrFalse, toNum, clampInt, clampNum, clamp, slugify | 137 → 126 |
| `utils/csv.js` | parseCsv, loadCsv | 120 → 116 |
| `catalog/normalize.js` | safeStr, safeNum, splitList, parsePipeList, localizedDatasheetUrl, parseRobustNum, extractUseCasesFromRow | 274 → 265 |
| `core/constants.js` | COLORS, LIM, CLR, COMELIT, CONFIG | 145 → 140 |
| `engine/storage.js` | mbpsToTB, getContextualMotionFactor | 244 → 241 |
| `app.js` | import `_localizedDatasheetUrl` depuis normalize.js | 1406 → 1407 |

`window.*` restants dans modules (intentionnels, NON shims) :
- `auth.js` : `window.Auth = Auth` — accès externe
- `kpi-tracker.js` : `window.kpi = fn` — event tracker global (appelé par steps.js)
- `i18n.js` : `window.T`, `window.setLang`, etc. — appelés depuis main.js inline

Build prod ✓ · Smoke test ✓ · 17 test files ✓

### ✅ PH10 — Fait (session courante)

Import de `safeHtml`, `toNum`, `clampInt`, `clampNum`, `clamp` depuis `utils/format.js` — suppression des 5 (×2 pour clampNum) définitions locales dupliquées dans app.js. Nettoyage associé :

- Orphelins supprimés : bare arrow expression `$$`, 4 semicolons isolés
- `window._getCameraById` en double supprimé
- 25 commentaires stales `// ✅ Phase 2 —` supprimés
- Bloc mort `// BRANDING COMELIT (PDF)` supprimé
- Net : **1 407 → 1 309 lignes** (−98L)
- Build prod ✓ · Smoke test ✓ · 17 test files ✓ · Commit `20252b3`

### ✅ PH11 — Fait (session courante)

Nettoyage structurel de app.js — héritage de l'IIFE supprimée en PH6.2 :
- 6 commentaires `// ✅ Phase 3 —` supprimés
- 5 blocs section header orphelins supprimés (`0B) CSV PARSER`, `4) NORMALIZATION`, `4A) SIGNAGE`, `4B) ACCESSORIES`, `2) MODEL`)
- 20 fonctions top-level normalisées : 2-space → colonne 0 (`scoreCameraForBlock`, `renderStepCameras`, `init`, etc.)
- `invalidateProjectCache` + KPI SAFETY SHIM : 4-space → 0
- Blank lines : max 2
- Net : **1 309 → 1 248 lignes** (−61L)
- Audit dead-code : 0 fonction inutilisée (42 fonctions, toutes actives)
- Build prod ✓ · Smoke test ✓ · 21 test files ✓ · Commit `63bdf35`

### ✅ PH12 — Fait (session courante)

Suppression des 51 pre-imports redondants de `main.js` :
- Hérités de l'époque `window.xxx = fn` shims — plus aucune utilité depuis PH6.5