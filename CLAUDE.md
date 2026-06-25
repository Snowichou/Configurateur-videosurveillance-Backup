# CLAUDE.md — Configurateur Vidéosurveillance Comelit

> Fichier de contexte pour Claude. Lu automatiquement à l'ouverture du projet.
> Dernière mise à jour : après session « Mesure DORI photo + gyroscope » (juin 2026).

---

## Projet

**Configurateur Vidéosurveillance** — application web qui guide l'installateur
Comelit pour dimensionner un système de vidéosurveillance IP (caméras, NVR,
stockage, PoE, accessoires). Résultat final : un récapitulatif et un export PDF.

- **Stack** : Vite + Vanilla JS (ESM), CSS custom, Vitest pour les tests
- **Backend** : FastAPI (Python) — catalogue produits, auth SSO Azure
- **Déploiement** : Railway
- **Langues** : fr / en / it / es / de (i18n maison dans `i18n.js`)

---

## Architecture actuelle

### Point d'entrée

```
frontend/src/main.js          Bootstrap (HTML, auth, meta PWA)
  └── dynamic import app.js   Orchestrateur principal
        └── dynamic import optimisations.js   UI extras (undo, recap, save)
```

### `frontend/src/app.js` — Orchestrateur ESM (1 045 lignes)

Le fichier central. Ce n'est **pas** un monolithe : c'est un orchestrateur fin
qui importe ~85 modules et expose l'état + les thin wrappers.

Structure interne :
1. **Imports** (~85 lignes) — tous les modules purs
2. **Constantes** — `COLORS`, `LIM`, `CONFIG`, `CLR`, etc.
3. **État** — `CATALOG` (chargé async), `MODEL` (mutable), `STEPS`, `KPI`
4. **`DEPS`** — objet central injecté dans toutes les fonctions pures
5. **Thin wrappers** — closent sur l'état, délèguent aux pures via `DEPS`
6. **`init()`** — bootstrap DOM, event listeners, render initial
7. **`export getOptimDeps()`** — deps exposés à `optimisations.js`

### `DEPS` — objet d'injection de dépendances

```js
const DEPS = {
  // Getters live (MODEL/CATALOG mutent au fil du temps)
  get MODEL()        { return MODEL; },
  get CATALOG()      { return CATALOG; },
  get cameraLines()  { return MODEL.cameraLines; },
  get cameraBlocks() { return MODEL.cameraBlocks; },
  get cameras()      { return CATALOG.CAMERAS; },
  get catalogNvrs()  { return CATALOG.NVRS; },
  get catalogHdds()  { return CATALOG.HDDS; },
  get getCameraById(){ return getCameraById; },
  // Valeurs directes (hoistées ou définies avant DEPS)
  T, CLR, clamp, clampInt, clampNum, toNum, safeHtml,
  getDoriForObjective, normalizeEmplacement, getMpFromCam, getIrFromCam,
  getCameraProfile, objectiveLabel, accessoryTypeLabel, objectiveToDoriKey,
  translateUseCase, getAllUseCases, localizedDatasheetUrl,
  sanitizeFilename, dedupByUrl,
  KPI, mbpsToTB,
  computeTotals, getTotalCameras, pickDisks, pickNvr, planPoESwitches,
  getProjectCached,
};
```

### `frontend/src/optimisations.js` — UI extras (666 lignes)

Module ESM avec `export function initOptimisations(deps)`. Gère :
undo/redo clavier, récap flottant, save/load local, partage URL, animations
step, swipe mobile, compare caméras, validation par étape, navigation guard.

### Modules extraits (`frontend/src/`)

| Dossier | Contenu |
|---|---|
| `utils/` | `format.js`, `csv.js`, `share.js`, `helpers.js` |
| `core/` | `constants.js` — couleurs, limites, labels scoring |
| `engine/` | 19 modules — calculs purs (stockage, NVR, PoE, scoring, projet, **measure-distance**...) |
| `catalog/` | `normalize.js`, `media.js` |
| `state/` | `model.js`, `lookups.js`, `actions.js` |
| `render/` | 17 modules — HTML generation (une fonction pure par écran) |
| `handlers/` | `steps.js`, `admin.js`, `summary.js`, `init.js`, `quote.js` |
| `storage/` | `photo-store.js` — wrapper IndexedDB (photos de mesure, 100 % local) |
| `ui/` | `toast.js`, `labels.js`, **`measure/`** (`gyro.js`, `capture.js`, `modal.js`, `photo-viewer.js`) |

---

## Commandes essentielles

```bash
cd frontend

# Dev
npm run dev                  # http://localhost:5173

# Build (utiliser /tmp pour éviter EPERM sur Windows)
npx vite build --outDir /tmp/dist-test

# Tests (vitest non installé dans node_modules — installer dans /tmp)
npm install --prefix /tmp/vitest-install vitest @vitest/coverage-v8 happy-dom fake-indexeddb
NODE_PATH=/tmp/vitest-install/node_modules \
  /tmp/vitest-install/node_modules/.bin/vitest run

# Lint
npm run lint
```

> **Note Git** : Le fichier `.git/index.lock` est parfois bloqué (montage Windows).
> Utiliser le plumbing Git pour commiter — voir section "Patterns" ci-dessous.

---

## Patterns établis

### Fonction pure + wrapper

```js
// Module pur (engine/xxx.js)
export function computeThingPure(input, { MODEL, T, getCameraById }) { ... }

// Wrapper dans app.js
function computeThing(input) { return computeThingPure(input, DEPS); }

// Render wrapper (deps uniques par appel)
function renderStep() {
  return renderStepPure({ ...DEPS, currentLang: getCurrentLang() });
}
```

### Getter vs référence directe dans DEPS (règle anti-TDZ)

```js
// ✅ const défini AVANT DEPS → référence directe
const KPI = ...;  // ligne ~196
const DEPS = { KPI };  // ligne ~275 → OK

// ✅ function declaration → hoistée → référence directe
function getCameraById() { ... }
const DEPS = { getCameraById };  // OK

// ✅ const défini APRÈS DEPS → getter obligatoire (sinon TDZ crash)
const DEPS = { get canRecommendBlock() { return canRecommendBlock; } };
const { canRecommendBlock } = createBlockLifecycleHandlers(...);  // post-DEPS
```

### Commit via plumbing Git (contourne le lock Windows)

```bash
TMPIDX=/tmp/gitidx_$(date +%s)
GIT_INDEX_FILE=$TMPIDX git read-tree HEAD
GIT_INDEX_FILE=$TMPIDX git update-index --add frontend/src/fichier.js
TREE=$(GIT_INDEX_FILE=$TMPIDX git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(GIT_INDEX_FILE=$TMPIDX git commit-tree "$TREE" -p "$PARENT" -m "message")
python3 -c "open('.git/refs/heads/main','w').write('$COMMIT\n')"
```

### Écriture de fichiers (pas Edit/Write tools — Python uniquement)

```python
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
```

---

## État du refactor (historique)

| Commit | Phase | Résultat |
|---|---|---|
| `9951c44` | PH17+18+cleanup | optimisations.js ESM, computeProject→DEPS, window shims removed |
| `c64e249` | PH16 | DEPS étendu (getProjectCached + 4 objets bespoke) |
| `5e7f8b4` | PH15 | Nettoyage comments, init() shorthand |
| `2d23a0e` | PH14 | T/getCurrentLang ESM, constants dedup, DEPS render wrappers |
| `7bb257c` | PH13 | i18n exports ESM, DEPS central |
| `9868b84` | PH9b | Purge window.xxx shims dans 6 modules purs |
| (origine) | — | app.js monolithe IIFE ~13 000 lignes |

**Résultat** : app.js 13 000L → 1 045L. 0 shim `window.xxx` dans les modules purs.
498 tests, 29 fichiers de test, tous au vert.

---

## Feature : Mesure DORI par photo + gyroscope (PWA)

L'installateur se place à l'emplacement de la caméra, saisit la **hauteur de
montage**, incline le téléphone vers la zone au sol : l'angle de plongée
(gyroscope) donne la **distance horizontale** par trigonométrie, qui alimente
le moteur DORI existant. Une photo (preuve visuelle) est stockée **100 % en
local**.

### Formule

```
distance_horizontale = hauteur_montage / tan(angle_de_plongée)
```

`angle_de_plongée` est dérivé de `DeviceOrientationEvent` :
portrait `90 - beta`, paysage `90 - |gamma|` (cf. `depressionFromOrientation`).

### Modules

| Fichier | Rôle |
|---|---|
| `engine/measure-distance.js` | **Pur** : `depressionFromOrientation`, `computeGroundDistance`, `measureFromPhone` + `MEASURE_LIMITS`. Cas limites : horizon (`angle_too_small`), vers le haut (`pointing_up`), hauteur invalide, bornage 999 m. |
| `ui/measure/gyro.js` | Capteur : support, permission iOS (`requestPermission`), orientation écran, abonnement. |
| `ui/measure/capture.js` | Caméra arrière (`getUserMedia` facingMode environment), capture JPEG `canvas.toBlob` qualité 0.6. |
| `ui/measure/modal.js` | `openMeasureModal({heightM,T,onResult})` — orchestration + repli manuel. |
| `ui/measure/photo-viewer.js` | `openPhotoViewer(...)` — lightbox lecture seule + suppression. |
| `storage/photo-store.js` | IndexedDB : `savePhoto/getPhoto/deletePhoto/clearProject`, clé `projectId::cameraId`, repli gracieux si IndexedDB indisponible. |

### Intégration

- **MODEL** : `answers.height_m` (champ bloc) + `answers.hasPhoto` (flag) +
  `MODEL.projectId` (id stable, persiste via **les 2 serializers** :
  `engine/persistence.js` ET `optimisations.js` clone/applySnapshot).
- **Wiring** : `openMeasureModal`, `openPhotoViewer`, `photoStore` injectés dans
  `createStepsHandlers(deps)` (app.js). Actions `data-action` :
  `measureDistance`, `viewPhoto`, `removePhoto`.
- **render/cameras.js** : champ hauteur + bouton « 📷 Mesurer » + boutons
  Voir/Supprimer (conditionnels sur `hasPhoto`).
- **Récap** (`render/summary-final.js`) : badge `📷 X m mesurés` sur les lignes
  caméra mesurées.

### Robustesse (phase 6, intégrée)

Permission gyro/caméra refusée, capteur absent, aucun event (<2,5 s),
angle ≈ 0° / vers le haut, paysage/portrait, IndexedDB indisponible →
**toujours** un repli (saisie manuelle de la distance) sans crash.

### PWA

`public/manifest.json` + `public/sw.js` (déplacés depuis `src/` — étaient
référencés à la racine `/` mais non servis : la PWA était inopérante).
Enregistrement SW dans `main.js`.

> **Dépendance test** : `fake-indexeddb` (devDependency) pour
> `__tests__/storage-photo-store.test.js`. Inclus dans la commande
> d'install vitest ci-dessus.

---

## Ce qui reste (prochaines sessions)

| Priorité | Tâche |
|---|---|
| Haute | **PH19** — `chips-enhancer.js` : convertir l'IIFE en ESM pur |
| Haute | **PH20** — Éclater `optimisations.js` (666L, 12 sections) en modules `src/ui/optim/` |
| Normale | **PH21** — `handlers/steps.js` : remplacer `window.kpi` par import ESM |
| Normale | **PH22** — Augmenter couverture tests (`engine/project.js`, `handlers/steps.js`, `render/pipeline.js`) |
| Normale | **PH23** — Supprimer thin wrappers devenus inutiles dans app.js |
| Basse | **PH24** — Chunking Rollup (chunk `index.js` = 1 810 kB — html2pdf/jsPDF) |

---

## Fichiers clés à lire pour reprendre

| Fichier | Pourquoi |
|---|---|
| `frontend/src/app.js` | Orchestrateur — état complet de l'architecture |
| `frontend/src/optimisations.js` | UI extras — pattern initOptimisations(deps) |
| `frontend/src/main.js` | Bootstrap + wiring dynamic imports |
| `frontend/src/core/constants.js` | Constantes centralisées |
| `frontend/src/engine/measure-distance.js` | Mesure DORI — trigo pure + cas limites |
| `frontend/src/storage/photo-store.js` | Stockage local IndexedDB des photos de mesure |
| `REFACTOR-PASSATION.md` | Détail technique complet + patterns + aide-mémoire |
| `CONTRIBUTING.md` | Conventions Git, workflow, checklist PR |

---

## window.xxx restants (légitimes, ne pas supprimer)

| Fichier | Symbole | Raison |
|---|---|---|
| `engine/kpi-tracker.js` | `window.KPI`, `window.kpi` | API cross-module KPI (design intentionnel) |
| `handlers/steps.js` | `window.kpi` | Consomme le KPI tracker |
| `auth.js` | `window.Auth` | SDK auth exposé globalement |
| `main.js` | `window.jsPDF`, `window.jspdf` | Interop html2pdf.js (attend window.jsPDF) |
| `optimisations.js` | `window.exportCatalogJSON` | Helper debug console |
| `app.js` | `window.KPI` (shim init) | Safety shim anti-crash au démarrage |
