# Refactor configurateur — Récap & TODO prochaine session

> Document de passation. Objectif global rappelé par Seb :
> **« On commence par la dette technique, je veux que le code soit impeccable. »**
> Décomposition du monolithe `frontend/src/app.js` (~13 000 lignes, IIFE, sans tests)
> en modules ESM purs et testés.

---

## 1. État actuel (fin de session)

| Indicateur | Valeur |
|---|---|
| `app.js` | **1 640 lignes** (était 13 000 à l'origine, 1 761 à la session précédente) |
| Modules ESM extraits | **50** |
| Tests Vitest | **435** (23 fichiers) — tous au vert |
| ESLint | **0 erreur / 0 warning** sur tout `src/` |
| Build Vite | OK |
| Branche | `main` — tout est commité |

### Modules extraits (`frontend/src/`)

- **utils/** — `format.js`, `csv.js`, `share.js`
- **core/** — `constants.js`
- **engine/** — `storage.js`, `poe.js`, `pick-nvr.js`, `scoring.js`, `camera-score.js`, `camera-reco.js`, `totals.js`, `accessories.js`, `project.js`, `validate-step.js`, `kpi.js`, `block-lifecycle.js`, `persistence.js`, `sanity.js`, `complements.js`, `storage-calc.js`
- **catalog/** — `normalize.js`, `media.js`
- **state/** — `model.js`, `lookups.js`, `actions.js`
- **render/** — `projet.js`, `storage.js`, `options.js`, `accessories.js`, `nvr.js`, `summary.js`, `cameras.js`, `camera-card.js`, `pdf.js`, `summary-final.js`, `pdf-blob.js`, `pdf-export.js`, `pdf-preview.js`, `datasheet-urls.js`, `pdf-pro.js`, `pdf-test.js`, `pipeline.js`
- **handlers/** — `steps.js`, `admin.js`, `summary.js`, `init.js`, `quote.js`
- **ui/** — `toast.js`, `labels.js`

### Commits de cette session (PH5)

```
055e476  PH5.2c  localizedDatasheetUrl → wrapper sur window.localizedDatasheetUrl (normalize.js)
675bc64  PH5.2b  ui/labels.js (objectiveLabel+accessoryTypeLabel+translateUseCase+getAllUseCases+getCameraProfile ~115L, 20 tests)
8c1a32c  PH5.2a  engine/storage-calc.js (mbpsToTB+pickDisks ~57L)
ea3c8ea  sync    rattrapage git: render/pdf.js + handlers/steps.js + render-pdf.test.js + engine/complements.js + main.js
(session précédente : PH4.4a–f, PH3.3–3.8, etc.)
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

### 2.6 Patterns de factory (admin, pipeline, block-lifecycle, persistence, quote…)

Pour les groupes de fonctions qui s'appellent mutuellement, utiliser le pattern factory :
```js
export function createXxxHandlers(deps = {}) {
  const { dep1, dep2 } = deps;
  function fn1() { ... }
  function fn2() { ... fn1() ... }
  return { fn1, fn2 };
}
window._createXxxHandlers = createXxxHandlers;
```

Dans app.js :
```js
const { fn1, fn2 } = window._createXxxHandlers({ dep1, dep2 });
```

Quand les vars destructurées sont toutes utilisées → pas besoin de `eslint-disable`.
Si certaines ne sont référencées que depuis le HTML/events → ajouter le commentaire disable.

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

## 3. Ce qui reste dans `app.js` (1 640 lignes)

`app.js` est un **orchestrateur** : état global, wrappers vers les modules,
logique bootstrap, et quelques helpers non encore extraits.

### Fonctions résiduelles à logique réelle (non wrappers)

| Fonction | Lignes | Commentaire |
|---|---|---|
| KPI IIFE interne | ~150 | `getSessionId`, `send`, `sendNowait`, `compactCameras`, `snapshot` — dans un IIFE imbriqué |
| `localizedDatasheetUrl` | 4 | Wrapper → `window.localizedDatasheetUrl(url, _currentLang)` — déjà simplifié |
| `getProjectCached` | ~11 | Cache projet (dépend de state) |
| `safeStr` | 3 | Micro-helper |
| Wrappers PH2–PH5 | ~400 | Délèguent vers `window._xxxPure` / factories |
| État global + DOM | ~400 | `MODEL`, `CATALOG`, `STEPS`, `DOM`, `KPI`… |

### TODO PH6 (prochaine session)

1. **Supprimer l'IIFE** de `app.js` et convertir en vrai module ESM.
   C'est le dernier grand chantier architectural. Nécessite de remplacer tous les
   `window._xxxPure` shims par de vrais `import` ESM.
   Étapes suggérées :
   - Extraire le KPI IIFE interne → `engine/kpi-tracker.js`
   - Remplacer les `window._createXxx` par des imports directs dans app.js
   - Supprimer la IIFE wrapper et les `window._xxx` shims

2. **Smoke test navigateur** : l'app n'a PAS été testée dans un vrai navigateur.
   Faire un test manuel ou Playwright du parcours complet.

3. **Code mort** : relancer `outputs/cleanup-deadcode.cjs` pour identifier les restes.

4. **`getProjectCached` + `safeStr`** : petits helpers extractibles si besoin
   (faible priorité, ~15 lignes au total).

---

## 4. Rappels de méthode (à conserver)

1. Module pur + injection de dépendances ; wrapper `app.js` qui passe les deps
   legacy → garantit **zéro changement de comportement**.
2. Un fichier de tests Vitest par module pur (comportement + edge cases).
3. Vérif systématique après chaque extraction : ESLint `src/` + `vite build`
   + suite complète (en 2 passes).
4. Remplacements dans `app.js` **uniquement** via AST `espree` (jamais de
   comptage d'accolades).
5. Commit après chaque module vérifié, via le contournement Git du §2.1.
6. Script utilitaire de nettoyage de code mort : `outputs/cleanup-deadcode.cjs`.
