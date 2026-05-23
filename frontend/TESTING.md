# 🧪 Tests — Configurateur Vidéosurveillance

Documentation des tests automatisés du projet.

---

## Vue d'ensemble

Le projet utilise **Vitest** comme runner de tests (rapide, syntaxe Jest-like,
intégration Vite native). Les tests sont dans `src/__tests__/`.

```
frontend/src/__tests__/
├── setup.js                       ← Mocks globaux (window.T, KPI, localStorage)
├── engine-storage.test.js         ← mbpsToTB, pickDisks, getContextualMotionFactor
├── engine-nvr.test.js             ← pickNvr, planPoESwitches
├── render-snapshots.test.js       ← Snapshots HTML stables
└── __snapshots__/                 ← .snap auto-générés par Vitest
```

---

## Commandes

```bash
# Lancer tous les tests une fois (mode CI)
npm test

# Mode watch (relance auto à chaque modif)
npm run test:watch

# UI Vitest dans le navigateur (parcours interactif)
npm run test:ui

# Rapport de couverture (HTML dans coverage/)
npm run coverage

# Mettre à jour les snapshots après changement intentionnel
npm test -- -u
```

---

## Philosophie

### Phase 0 — Harness temporaire (état actuel)

`app.js` est aujourd'hui un seul IIFE monolithique sans exports. Les tests
**réimplémentent localement** les fonctions critiques (versions "miroir")
pour pouvoir les valider sans toucher au code de production.

**Pourquoi cette approche ?**
- Pas de risque de casser l'existant (aucune modification de `app.js`)
- Documentation exécutable du comportement actuel
- Quand on splittera en modules ESM, il suffira de remplacer les copies
  locales par des imports : `import { mbpsToTB } from '../engine/pick-disks.js';`

### Phase 1+ — Tests sur modules réels (futur)

Une fois `app.js` découpé en modules ESM (cf. plan refactor), les tests
importeront directement les fonctions publiques. Les "miroirs" Phase 0
seront supprimés progressivement.

---

## Catégories de tests

### 1. Tests unitaires de l'engine (fonctions pures)

**Fonctions testées** : `mbpsToTB`, `pickDisks`, `getContextualMotionFactor`,
`pickNvr`, `planPoESwitches`.

Critères :
- Aucun accès au DOM
- Aucune dépendance à `MODEL` / `CATALOG` globaux (injection par paramètres)
- Cas limites couverts (zéro, dépassement, valeurs inattendues)
- Résultats déterministes

### 2. Snapshot tests (HTML rendering)

Capturent l'output HTML des fonctions de rendu pures pour détecter
les régressions visuelles.

**Mise à jour des snapshots** : après un changement intentionnel du HTML,
relancer `npm test -- -u` puis vérifier le diff dans le `.snap` avant commit.

### 3. Tests de sécurité (basiques)

Vérifient que `safeHtml()` échappe correctement les caractères spéciaux
pour prévenir les injections XSS dans les outputs.

---

## Ajouter un nouveau test

```js
// src/__tests__/mon-nouveau.test.js
import { describe, it, expect } from 'vitest';

describe('Ma fonctionnalité', () => {
  it('fait ce qu\'on attend', () => {
    expect(maFonction(input)).toBe(outputAttendu);
  });

  it('gère les cas limites', () => {
    expect(maFonction(null)).toBeNull();
    expect(maFonction(undefined)).toBeNull();
  });
});
```

---

## Couverture attendue

| Module | Couverture cible | Statut Phase 0 |
|---|---|---|
| Engine HDD (mbpsToTB, pickDisks, motion) | 90% | ✅ 12 tests |
| Engine NVR (pickNvr, switches) | 80% | ✅ 14 tests |
| Render snapshots (tips, descriptions, recap) | Détection régression | ✅ 12 tests |
| Camera scoring (DORI, recommend) | 80% | ⏳ Phase 1 |
| PDF builder | Smoke test | ⏳ Phase 2 |
| Handlers (clicks/inputs) | E2E Playwright | ⏳ Phase 3 |

**Total Phase 0 : ~38 tests** couvrant l'engine business critique.

---

## Bonnes pratiques

1. **Tests parlants** : `it('20 cams tout-NEXT → auto-upgrade vers ADVANCE')` plutôt que `it('test 5')`
2. **AAA pattern** : Arrange (fixtures) → Act (appel fonction) → Assert (expect)
3. **Pas de logique** dans les tests : pas de boucles, pas de if/else
4. **Fixtures réutilisables** en haut du fichier
5. **Snapshots petits** : 1 fonction = 1 snapshot, pas tout le DOM
6. **Avant un commit** : `npm test` doit passer en local

---

## Liens utiles

- [Doc Vitest](https://vitest.dev/)
- [Migration Jest → Vitest](https://vitest.dev/guide/migration.html)
- [Snapshot tests](https://vitest.dev/guide/snapshot.html)
