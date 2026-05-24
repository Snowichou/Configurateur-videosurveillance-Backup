# Refactor configurateur — Récap & TODO prochaine session

> Document de passation. Objectif global rappelé par Seb :
> **« On commence par la dette technique, je veux que le code soit impeccable. »**
> Décomposition du monolithe `frontend/src/app.js` (~13 000 lignes, IIFE, sans tests)
> en modules ESM purs et testés.

---

## 1. État actuel (fin de session)

| Indicateur | Valeur |
|---|---|
| `app.js` | **3 735 lignes** (était 7 272 en début de session, ~13 000 à l'origine) |
| Modules ESM extraits | **30** |
| Tests Vitest | **375** (19 fichiers) — tous au vert |
| ESLint | **0 erreur / 0 warning** sur tout `src/` |
| Build Vite | OK |
| Branche | `main` — tout est commité |

### Modules extraits (`frontend/src/`)

- **utils/** — `format.js`, `csv.js`
- **core/** — `constants.js`
- **engine/** — `storage.js`, `poe.js`, `pick-nvr.js`, `scoring.js`, `camera-score.js`, `camera-reco.js`, `totals.js`, `accessories.js`, `project.js`
- **catalog/** — `normalize.js`
- **state/** — `model.js`, `lookups.js`, `actions.js`
- **render/** — `projet.js`, `storage.js`, `options.js`, `accessories.js`, `nvr.js`, `summary.js`, `cameras.js`, `camera-card.js`, `pdf.js`, `summary-final.js`, `pdf-blob.js`, `pdf-export.js`, `pdf-preview.js`
- **handlers/** — `steps.js`

### Commits de cette session (7)

```
5164043  PH2.25  render/pdf-preview.js (showPdfPreview 179L)
4c31f16  PH2.24  render/pdf-export.js (exportProjectPdfWithLocalDatasheetsZip 195L)
ccc50bc  PH2.23  render/pdf-blob.js (buildPdfBlobProFromProject 282L)
2ed5c8d  PH2.22  render/summary-final.js (renderFinalSummary 271L)
278ea69  PH2.21  engine/project.js (computeProject) + 16 tests
cc05bfb  PH2.20  handlers/steps.js (onStepsClick/Change/Input)
ad20859  PH2.19  render/pdf.js (buildPdfHtml 2026L)
```

---

## 2. ⚠️ Pièges d'environnement — À LIRE avant de reprendre

### 2.1 Git : le verrou Windows bloque `git commit`

Le montage Windows interdit l'`unlink` côté sandbox Linux. Résultat : `.git/index.lock`
(et les locks de refs) deviennent **orphelins** et bloquent tout `git commit` normal.

**Contournement utilisé** (à réutiliser tel quel) — n'utilise aucun verrou :

```bash
cd <repo>
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

### 2.5 Vérification build/tests

Build + suite complète dépassent le timeout de 45 s du bash → lancer en **deux appels séparés** :

```bash
# Pass 1 (engine + render-pdf)
node node_modules/vitest/vitest.mjs run src/__tests__/engine-*.test.js src/__tests__/render-pdf.test.js

# Pass 2 (render + state + utils + catalog)
node node_modules/vitest/vitest.mjs run src/__tests__/catalog-*.test.js src/__tests__/render-{accessories,camera-card,cameras,nvr,options,projet,storage,summary}.test.js src/__tests__/state-*.test.js src/__tests__/utils-*.test.js
```

`vite build` vers `/tmp` : `--outDir /tmp/vite-phXXX --emptyOutDir`

---

## 3. Ce qui reste dans `app.js` (3 735 lignes)

`app.js` est maintenant un **orchestrateur** : état global, wrappers vers les modules,
quelques fonctions helper non extraites.

### Fonctions encore dans `app.js` (non extraites — PH3)

| Fonction | Lignes | Raison de rester |
|---|---|---|
| `bindSummaryButtons` | 74 | Orchestrateur pur (12 dépendances app.js) |
| `init` | 86 | Bootstrap app — charge CSV, initialise CATALOG |
| `collectDatasheetUrlsFromProject` | ~60 | Helper utilisé par `pdf-export.js` |
| `kpiConfigSnapshot` | 92 | Snapshot KPI — dépend de tout le state |
| Helpers divers | ~200 | `safeHtml`, `clampInt`, `clampNum`, `mbpsToTB`, etc. |
| Wrappers PH2 | ~200 | Délèguent vers `window._xxxPure` |
| État global + DOM | ~500 | `MODEL`, `CATALOG`, `STEPS`, `DOM`, `KPI`… |
| Render pipeline | ~1500 | `render()`, `renderStep()`, `syncResultsUI()`, etc. |

### TODO PH3

1. **Remplacer les shims `window._xxxPure`** par de vrais `import` ESM dans chaque module.
   `app.js` importera directement les fonctions au lieu de les exposer via `window`.
2. **Extraire `render()` + pipeline de rendu** (~1500L restantes) — le plus gros bloc non extrait.
3. **Smoke test navigateur** : l'app n'a PAS été testée dans un vrai navigateur cette session.
   Faire un test manuel ou Playwright du parcours complet.
4. **Code mort** : relancer `outputs/cleanup-deadcode.cjs` pour identifier les restes.

---

## 4. Rappels de méthode (à conserver)

1. Module pur + injection de dépendances ; wrapper `app.js` qui passe les deps
   legacy → garantit **zéro changement de comportement**.
2. Un fichier de tests Vitest par module pur (comportement + edge cases).
3. Vérif systématique après chaque extraction : ESLint `src/` + `vite build`
   + suite complète (en 2 passes).
4. Remplacements dans `app.js` **uniquement** via AST `espree` (jamais de
   comptage d'accolades).
5. Commit après chaque module vérifi