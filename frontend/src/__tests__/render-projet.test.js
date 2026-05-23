// ============================================================
// Tests render/projet.js — Étape 0 Projet (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepProject, mergeProjectUseCases } from '../render/projet.js';
import { createInitialModel } from '../state/model.js';

// ─── mergeProjectUseCases ───────────────────────────────────
describe('mergeProjectUseCases', () => {
  it('garantit la liste fixe même si CSV vide', () => {
    const out = mergeProjectUseCases([]);
    expect(out).toEqual(['Résidentiel', 'Tertiaire', 'Logement collectif', 'Parking', 'Industriel']);
  });

  it('ajoute les use_cases CSV inconnus', () => {
    const out = mergeProjectUseCases(['Hôpital', 'Tertiaire']);
    expect(out).toContain('Hôpital');
    // Tertiaire déjà dans la liste fixe → pas de doublon
    expect(out.filter((u) => u === 'Tertiaire')).toHaveLength(1);
  });

  it('exclut les variantes Intrusion (gérées côté caméra)', () => {
    const out = mergeProjectUseCases(['Intrusion résidentielle', 'Bureau']);
    expect(out).not.toContain('Intrusion résidentielle');
    expect(out).toContain('Bureau');
  });

  it('null/undefined → liste fixe', () => {
    expect(mergeProjectUseCases(null)).toEqual([
      'Résidentiel',
      'Tertiaire',
      'Logement collectif',
      'Parking',
      'Industriel',
    ]);
    expect(mergeProjectUseCases()).toHaveLength(5);
  });
});

// ─── renderStepProject — fixtures partagées ─────────────────
const baseDeps = () => ({
  model: createInitialModel(),
  T: (k) => `i18n(${k})`,
  csvUseCases: ['Bureau'],
  limits: { maxProjectNameLength: 80 },
  projectTipHtml: () => '<div class="tip">tip-stub</div>',
  useCaseDescriptionHtml: () => '<div class="desc">desc-stub</div>',
  translateUseCase: (u) => `tr(${u})`,
  saveCardHtml: '<div class="saveCard">save-stub</div>',
});

// ─── renderStepProject — comportement ───────────────────────
describe('renderStepProject', () => {
  it('retourne une string non vide', () => {
    const html = renderStepProject(baseDeps());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(200);
  });

  it('affiche les valeurs MODEL (name, useCase, tags, notes)', () => {
    const deps = baseDeps();
    deps.model.projectName = 'Mon site';
    deps.model.projectUseCase = 'Tertiaire';
    deps.model.projectTags = 'client,site-paris';
    deps.model.projectNotes = 'Notes commerciales';
    const html = renderStepProject(deps);
    expect(html).toContain('value="Mon site"');
    expect(html).toContain('client,site-paris');
    expect(html).toContain('Notes commerciales');
  });

  it('échappe les caractères HTML dangereux dans les inputs', () => {
    const deps = baseDeps();
    deps.model.projectName = '<script>alert(1)</script>';
    const html = renderStepProject(deps);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('marque le useCase courant comme selected', () => {
    const deps = baseDeps();
    deps.model.projectUseCase = 'Parking';
    const html = renderStepProject(deps);
    expect(html).toMatch(/<option value="Parking" selected>/);
  });

  it('inclut les use_cases CSV en plus de la liste fixe', () => {
    const html = renderStepProject(baseDeps());
    // Liste fixe
    expect(html).toContain('<option value="Résidentiel"');
    // CSV ajouté
    expect(html).toContain('<option value="Bureau"');
  });

  it('badge OK quand name + useCase remplis', () => {
    const deps = baseDeps();
    deps.model.projectName = 'X';
    deps.model.projectUseCase = 'Tertiaire';
    const html = renderStepProject(deps);
    expect(html).toContain('✅');
    expect(html).toContain('i18n(proj_complete)');
    expect(html).not.toContain('i18n(proj_incomplete)');
  });

  it("badge 🏠 quand le projet n'est pas complet", () => {
    const html = renderStepProject(baseDeps());
    expect(html).toContain('🏠');
    expect(html).toContain('i18n(proj_incomplete)');
  });

  it('utilise translateUseCase pour les labels des options', () => {
    const html = renderStepProject(baseDeps());
    expect(html).toContain('tr(Résidentiel)');
    expect(html).toContain('tr(Tertiaire)');
  });

  it('injecte les helpers projectTipHtml / useCaseDescriptionHtml', () => {
    const html = renderStepProject(baseDeps());
    expect(html).toContain('tip-stub');
    expect(html).toContain('desc-stub');
  });

  it('inclut saveCardHtml dans la colonne droite', () => {
    const html = renderStepProject(baseDeps());
    expect(html).toContain('save-stub');
  });

  it('respecte limits.maxProjectNameLength', () => {
    const deps = baseDeps();
    deps.limits = { maxProjectNameLength: 50 };
    const html = renderStepProject(deps);
    expect(html).toContain('maxlength="50"');
  });

  it('utilise maxName=80 par défaut si limits absent', () => {
    const deps = baseDeps();
    delete deps.limits;
    const html = renderStepProject(deps);
    expect(html).toContain('maxlength="80"');
  });

  it("ouvre <details> automatiquement si tags ou notes sont remplis", () => {
    const deps = baseDeps();
    deps.model.projectTags = 'client';
    const html = renderStepProject(deps);
    // L'attribut HTML "open" doit être présent sur le details
    expect(html).toMatch(/<details[^>]*\bopen\b/);
  });

  it('snapshot stable du rendu vierge', () => {
    const html = renderStepProject(baseDeps());
    expect(html).toMatchSnapshot();
  });

  it('snapshot stable du rendu rempli', () => {
    const deps = baseDeps();
    deps.model.projectName = 'Projet ACME';
    deps.model.projectUseCase = 'Parking';
    deps.model.projectTags = 'acme';
    deps.model.projectNotes = 'Notes test';
    const html = renderStepProject(deps);
    expect(html).toMatchSnapshot();
  });
});
