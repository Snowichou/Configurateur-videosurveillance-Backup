// ============================================================
// Tests state/actions.js — Mutations basiques du MODEL
// ============================================================

import { describe, it, expect } from 'vitest';
import { uid, createEmptyCameraBlock, resetModel, setProjectField } from '../state/actions.js';
import { createInitialModel } from '../state/model.js';

// ─── uid ────────────────────────────────────────────────────
describe('uid', () => {
  it('produit une chaîne avec le préfixe demandé', () => {
    expect(uid('B')).toMatch(/^B_/);
    expect(uid('CAM')).toMatch(/^CAM_/);
  });

  it('défaut → préfixe "ID"', () => {
    expect(uid()).toMatch(/^ID_/);
  });

  it('chaque appel produit un id différent', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(uid('X'));
    expect(ids.size).toBe(100);
  });
});

// ─── createEmptyCameraBlock ─────────────────────────────────
describe('createEmptyCameraBlock', () => {
  it('retourne un bloc avec defaults sains', () => {
    const b = createEmptyCameraBlock();
    expect(b.id).toMatch(/^B_/);
    expect(b.label).toBe('');
    expect(b.qty).toBe(1);
    expect(b.quality).toBe('standard');
    expect(b.currentStep).toBe(0);
    expect(b.validated).toBe(false);
    expect(b.accessories).toEqual([]);
    expect(b.selectedCameraId).toBeNull();
  });

  it('hérite du use_case projet', () => {
    expect(createEmptyCameraBlock('Tertiaire').answers.use_case).toBe('Tertiaire');
    expect(createEmptyCameraBlock().answers.use_case).toBe('');
  });

  it('answers contient tous les champs wizard', () => {
    const b = createEmptyCameraBlock();
    expect(b.answers).toMatchObject({
      use_case: '',
      emplacement: 'exterieur',
      ai_type: '',
      objective: '',
      distance_m: '',
      mounting: 'wall',
      force_camera_type: '',
    });
  });

  it('uidFn injectable (utile pour tests déterministes)', () => {
    const fixedUid = () => 'FIXED_ID';
    expect(createEmptyCameraBlock('', fixedUid).id).toBe('FIXED_ID');
  });
});

// ─── resetModel ─────────────────────────────────────────────
describe('resetModel', () => {
  it('remet à zéro un MODEL muté', () => {
    const m = createInitialModel();
    m.cameraBlocks = [{ id: 'x' }, { id: 'y' }];
    m.cameraLines = [{ qty: 5 }];
    m.recording.fps = 99;

    resetModel(m);

    expect(m.cameraLines).toEqual([]);
    expect(m.recording.fps).toBe(25); // défaut FALLBACK_LIMITS
  });

  it('mute la même référence (pas un nouvel objet)', () => {
    const m = createInitialModel();
    const ref = m;
    resetModel(m);
    expect(m).toBe(ref); // même reference
  });

  it('withInitialBlock=true (défaut) → ajoute un bloc vide', () => {
    const m = createInitialModel();
    m.cameraBlocks = [];
    resetModel(m);
    expect(m.cameraBlocks).toHaveLength(1);
    expect(m.cameraBlocks[0].validated).toBe(false);
  });

  it('withInitialBlock=false → liste vide', () => {
    const m = createInitialModel();
    resetModel(m, undefined, { withInitialBlock: false });
    expect(m.cameraBlocks).toEqual([]);
  });

  it('keepProject=true (défaut) → conserve projectName/UseCase/Notes/Tags', () => {
    const m = createInitialModel();
    m.projectName = 'Mon projet';
    m.projectUseCase = 'Tertiaire';
    m.projectNotes = 'Notes commerciales';
    m.projectTags = 'client,site-a';
    m.cameraBlocks = [{ id: 'tobedeleted' }];

    resetModel(m);

    expect(m.projectName).toBe('Mon projet');
    expect(m.projectUseCase).toBe('Tertiaire');
    expect(m.projectNotes).toBe('Notes commerciales');
    expect(m.projectTags).toBe('client,site-a');
    // cameraBlocks tout de même réinitialisé
    expect(m.cameraBlocks).toHaveLength(1);
    expect(m.cameraBlocks[0].id).not.toBe('tobedeleted');
  });

  it('keepProject=false → tout réinitialise', () => {
    const m = createInitialModel();
    m.projectName = 'Mon projet';
    resetModel(m, undefined, { keepProject: false });
    expect(m.projectName).toBe('');
  });

  it('conserve ui.mode / ui.demo / ui.favorites par défaut', () => {
    const m = createInitialModel();
    m.ui.mode = 'expert';
    m.ui.demo = true;
    m.ui.favorites = ['cam1', 'cam2'];
    resetModel(m);
    expect(m.ui.mode).toBe('expert');
    expect(m.ui.demo).toBe(true);
    expect(m.ui.favorites).toEqual(['cam1', 'cam2']);
  });

  it('respecte des limits explicites', () => {
    const m = createInitialModel();
    resetModel(m, { defaultFps: 15, defaultRetentionDays: 7 });
    expect(m.recording.fps).toBe(15);
    expect(m.recording.daysRetention).toBe(7);
  });

  it('le bloc initial hérite du projectUseCase préservé', () => {
    const m = createInitialModel();
    m.projectUseCase = 'Parking';
    resetModel(m);
    expect(m.cameraBlocks[0].answers.use_case).toBe('Parking');
  });

  it('null/undefined model → no-op safe', () => {
    expect(() => resetModel(null)).not.toThrow();
    expect(() => resetModel(undefined)).not.toThrow();
  });
});

// ─── setProjectField ────────────────────────────────────────
describe('setProjectField', () => {
  it('met à jour les 4 champs supportés', () => {
    const m = createInitialModel();
    setProjectField(m, 'name', 'A');
    setProjectField(m, 'useCase', 'B');
    setProjectField(m, 'notes', 'C');
    setProjectField(m, 'tags', 'D');
    expect(m.projectName).toBe('A');
    expect(m.projectUseCase).toBe('B');
    expect(m.projectNotes).toBe('C');
    expect(m.projectTags).toBe('D');
  });

  it('trim auto', () => {
    const m = createInitialModel();
    setProjectField(m, 'name', '  Hello  ');
    expect(m.projectName).toBe('Hello');
  });

  it('null/undefined → ""', () => {
    const m = createInitialModel();
    setProjectField(m, 'name', null);
    expect(m.projectName).toBe('');
    setProjectField(m, 'name', undefined);
    expect(m.projectName).toBe('');
  });

  it('key inconnue → no-op', () => {
    const m = createInitialModel();
    const before = { ...m };
    setProjectField(m, 'unknownKey', 'foo');
    expect(m.projectName).toBe(before.projectName);
  });
});
