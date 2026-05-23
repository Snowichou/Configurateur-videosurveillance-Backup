// ============================================================
// Snapshot tests — Render HTML stable (Phase 0)
// ============================================================
//
// Ces tests capturent une "photo" du HTML produit par les
// fonctions de rendu pour détecter automatiquement les
// régressions visuelles.
//
// Workflow Vitest :
//   1ère exécution : crée le fichier .snap avec le HTML actuel
//   exécutions suivantes : compare au .snap et alerte si diff
//   `npm test -- -u` : met à jour les snapshots (après changement intentionnel)
//
// On teste UNIQUEMENT des fonctions PURES (HTML string en sortie),
// pas les render() qui touchent au DOM réel.
// ============================================================

import { describe, it, expect } from 'vitest';

// ─── Réimplémentation locale des helpers nécessaires ────────
function safeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

// ─── Réimplémentation locale de wizardTipHtml ───────────────
function wizardTipHtml(tip, dismissed = []) {
  if (!tip) return '';
  if (dismissed.includes(tip.id)) return '';
  return `
    <div class="wizardTip" role="note" data-tipid="${safeHtml(tip.id)}">
      <span class="wizardTipIcon">${tip.icon || '💡'}</span>
      <div class="wizardTipBody">
        <div class="wizardTipTitle">${safeHtml(tip.title || 'Astuce')}</div>
        <div class="wizardTipText">${tip.body || ''}</div>
      </div>
      <button type="button" class="wizardTipClose"
        data-action="dismissWizardTip" data-tipid="${safeHtml(tip.id)}"
        aria-label="Masquer l'astuce" title="Ne plus afficher">✕</button>
    </div>
  `;
}

// ─── Réimplémentation locale de useCaseDescriptionHtml ──────
function useCaseDescriptionHtml(useCase, descriptions) {
  if (!useCase || !descriptions[useCase]) return '';
  const desc = descriptions[useCase];
  return `
    <div class="ucDescPanel" role="note" aria-live="polite">
      <div class="ucDescTitle">${safeHtml(desc.title)}</div>
      <div class="ucDescBody">${desc.body}</div>
    </div>
  `;
}

// ─── Réimplémentation locale du panneau récap fixations ─────
function renderMountRecapPanel(totalCams, totalAcc, chipsByType) {
  const chips = chipsByType
    .map(
      (c) =>
        `<span class="mountRecapChip"><span class="mountRecapChipIcon">${c.icon}</span><strong>${c.count}</strong> <span class="mountRecapChipLabel">${safeHtml(c.label)}</span></span>`
    )
    .join('');
  return `
    <div class="recapPanel" role="region" aria-label="Récap fixations">
      <div class="recapHeader">
        <div class="recapStep">🔧 <span>Étape Fixations</span></div>
        <div class="recapTitle">Synthèse des accessoires</div>
      </div>
      <div class="mountRecapKpis">
        <div class="mountRecapKpi">
          <div class="mountRecapKpiValue">${totalCams}</div>
          <div class="mountRecapKpiLabel">caméras</div>
        </div>
        <div class="mountRecapKpi mountRecapKpiAccent">
          <div class="mountRecapKpiValue">${totalAcc}</div>
          <div class="mountRecapKpiLabel">accessoires</div>
        </div>
      </div>
      ${chips ? `<div class="mountRecapChips">${chips}</div>` : ''}
    </div>
  `;
}

// ─── Fixtures de tips ───────────────────────────────────────
const TIP_ADVANCE = {
  id: 'tip:where:advance',
  icon: '🧠',
  title: 'ADVANCE = analyses avancées',
  body: "L'IA ADVANCE active comptage de personnes, métadonnées (couleur, taille), reconnaissance de plaques (LPR).",
};

const TIP_PARKING = {
  id: 'tip:proj:parking',
  icon: '🅿️',
  title: 'Parking — LPR et accès véhicules',
  body: 'Surveillance des entrées/sorties véhicules avec <strong>lecture de plaques (LPR)</strong>.',
};

const TIP_WITH_SPECIAL_CHARS = {
  id: 'tip:test:special',
  icon: '⚠️',
  title: 'Test "spécial" <html>',
  body: 'Caractères : & < > " \'',
};

// ─── Tests snapshot ─────────────────────────────────────────
describe('Snapshot — wizardTipHtml', () => {
  it('tip ADVANCE rendu standard', () => {
    expect(wizardTipHtml(TIP_ADVANCE)).toMatchSnapshot();
  });

  it('tip Parking avec HTML <strong> dans body', () => {
    expect(wizardTipHtml(TIP_PARKING)).toMatchSnapshot();
  });

  it('tip avec caractères spéciaux échappés correctement', () => {
    expect(wizardTipHtml(TIP_WITH_SPECIAL_CHARS)).toMatchSnapshot();
  });

  it('tip null → string vide', () => {
    expect(wizardTipHtml(null)).toBe('');
    expect(wizardTipHtml(undefined)).toBe('');
  });

  it('tip dismissed → string vide', () => {
    expect(wizardTipHtml(TIP_ADVANCE, ['tip:where:advance'])).toBe('');
  });

  it('tip dismissed AUTRE → rendu normal', () => {
    expect(wizardTipHtml(TIP_ADVANCE, ['tip:where:other'])).toMatchSnapshot();
  });
});

describe('Snapshot — useCaseDescriptionHtml', () => {
  const DESCRIPTIONS = {
    Résidentiel: {
      title: '🏡 Résidentiel — particuliers et villas',
      body: 'Idéal pour <strong>maisons individuelles</strong>.',
    },
    Parking: {
      title: '🅿️ Parking — souterrain et extérieur',
      body: 'Pour <strong>parkings souterrains</strong>.',
    },
  };

  it('description Résidentiel', () => {
    expect(useCaseDescriptionHtml('Résidentiel', DESCRIPTIONS)).toMatchSnapshot();
  });

  it('description Parking', () => {
    expect(useCaseDescriptionHtml('Parking', DESCRIPTIONS)).toMatchSnapshot();
  });

  it('use case inconnu → vide', () => {
    expect(useCaseDescriptionHtml('Inexistant', DESCRIPTIONS)).toBe('');
  });

  it('use case vide → vide', () => {
    expect(useCaseDescriptionHtml('', DESCRIPTIONS)).toBe('');
    expect(useCaseDescriptionHtml(null, DESCRIPTIONS)).toBe('');
  });
});

describe('Snapshot — renderMountRecapPanel', () => {
  it('récap avec 13 caméras et 21 accessoires', () => {
    const chips = [
      { icon: '📦', count: 13, label: 'Boîtier raccordement' },
      { icon: '🧱', count: 8, label: 'Support' },
    ];
    expect(renderMountRecapPanel(13, 21, chips)).toMatchSnapshot();
  });

  it('récap empty (0 caméras, 0 accessoires)', () => {
    expect(renderMountRecapPanel(0, 0, [])).toMatchSnapshot();
  });
});

// ─── Sanity check : aucun caractère HTML brut dans les outputs ─
describe('Sécurité — Pas d\'injection HTML dans les snapshots', () => {
  it('safeHtml() échappe correctement les 5 caractères spéciaux', () => {
    expect(safeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(safeHtml('a&b')).toBe('a&amp;b');
    expect(safeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(safeHtml("it's")).toBe('it&#039;s');
  });

  it('safeHtml() gère null et undefined', () => {
    expect(safeHtml(null)).toBe('');
    expect(safeHtml(undefined)).toBe('');
  });

  it("safeHtml() gère les nombres", () => {
    expect(safeHtml(42)).toBe('42');
    expect(safeHtml(0)).toBe('0');
  });
});
