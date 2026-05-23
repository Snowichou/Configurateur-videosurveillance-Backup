// ============================================================
// Tests render/cameras.js — Étape Caméras (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepCameras } from '../render/cameras.js';

const baseBlock = (o = {}) => ({
  id: 'b1',
  label: '',
  qty: 1,
  validated: false,
  quality: 'standard',
  answers: { emplacement: 'interieur', objective: 'detection', distance_m: 15 },
  ...o,
});

const camDb = {
  'CAM-1': { id: 'CAM-1', name: 'Camera One', brand_range: 'NEXT', mp: 4, ir: 30 },
  'CAM-2': { id: 'CAM-2', name: 'Camera Two', brand_range: 'ADVANCE', mp: 8, ir: 50 },
};

const baseDeps = (o = {}) => ({
  cameraBlocks: [baseBlock()],
  activeBlockId: 'b1',
  ui: { favorites: [], mode: 'simple', onlyFavs: false, compare: [] },
  T: (k) => `i18n(${k})`,
  normalizeEmplacement: (x) => x,
  objectiveLabel: (x) => `OBJ(${x})`,
  canRecommendBlock: (b) =>
    !!(b && b.answers && b.answers.emplacement && b.answers.objective && b.answers.distance_m),
  buildRecoForBlock: () => ({
    primary: { camera: camDb['CAM-1'] },
    alternatives: [{ camera: camDb['CAM-2'] }],
    reasons: [],
  }),
  interpretScoreForBlock: () => ({ level: 'ok', score: 90, ratio: 1.2 }),
  getCameraById: (id) => camDb[id] || null,
  getMpFromCam: (c) => c.mp || 0,
  getIrFromCam: (c) => c.ir || 0,
  camPickCardHTML: (blk, cam, label) => `<div class="camPickCard" data-id="${cam.id}">${label}</div>`,
  ...o,
});

describe('renderStepCameras', () => {
  it('structure de base : stepSplit + colonnes + bouton addBlock', () => {
    const html = renderStepCameras(baseDeps());
    expect(html).toContain('stepSplit');
    expect(html).toContain('blocksCol');
    expect(html).toContain('proposalsCol');
    expect(html).toContain('data-action="addBlock"');
    expect(html).toContain('i18n(cam_add_block)');
  });

  it('rend une carte par bloc caméra', () => {
    const deps = baseDeps({
      cameraBlocks: [baseBlock({ id: 'b1' }), baseBlock({ id: 'b2' })],
    });
    const html = renderStepCameras(deps);
    expect((html.match(/cameraBlockCard/g) || []).length).toBe(2);
    expect(html).toContain('data-bid="b1"');
    expect(html).toContain('data-bid="b2"');
  });

  it('bloc actif → outline + badge cam_active', () => {
    const html = renderStepCameras(baseDeps());
    expect(html).toContain('outline:1px solid rgba(0,150,255,.35)');
    expect(html).toContain('i18n(cam_active)');
  });

  it('champs du bloc : emplacement / objectif / distance / quantité', () => {
    const html = renderStepCameras(baseDeps());
    expect(html).toContain('data-field="emplacement"');
    expect(html).toContain('data-field="objective"');
    expect(html).toContain('data-field="distance_m"');
    expect(html).toContain('data-action="inputBlockQty"');
    expect(html).toContain('OBJ(detection)');
  });

  it('bloc validé → bouton annuler validation', () => {
    const html = renderStepCameras(baseDeps({ cameraBlocks: [baseBlock({ validated: true })] }));
    expect(html).toContain('data-action="unvalidateBlock"');
    expect(html).toContain('i18n(cam_cancel_validation)');
  });

  it('bloc non validé → pas de bouton annuler validation', () => {
    const html = renderStepCameras(baseDeps());
    expect(html).not.toContain('data-action="unvalidateBlock"');
  });

  it('bloc incomplet → message cam_fill_required', () => {
    const incomplete = baseBlock({ answers: { emplacement: 'interieur' } });
    const html = renderStepCameras(baseDeps({ cameraBlocks: [incomplete] }));
    expect(html).toContain('i18n(cam_fill_required)');
  });

  it('pas de caméra primaire → err_no_camera_compatible + raisons', () => {
    const html = renderStepCameras(
      baseDeps({
        buildRecoForBlock: () => ({ primary: null, reasons: ['Trop loin', 'IP insuffisant'] }),
      }),
    );
    expect(html).toContain('i18n(err_no_camera_compatible)');
    expect(html).toContain('Trop loin');
    expect(html).toContain('IP insuffisant');
  });

  it('caméra primaire → cartes via camPickCardHTML (Meilleur choix + Alternative)', () => {
    const html = renderStepCameras(baseDeps());
    expect(html).toContain('cameraCards');
    expect(html).toContain('data-id="CAM-1"');
    expect(html).toContain('Meilleur choix');
    expect(html).toContain('data-id="CAM-2"');
    expect(html).toContain('Alternative');
  });

  it('mode simple → max 3 cartes', () => {
    const alts = ['CAM-2', 'CAM-3', 'CAM-4', 'CAM-5'].map((id) => ({ camera: { id, mp: 2, ir: 10 } }));
    const html = renderStepCameras(
      baseDeps({
        buildRecoForBlock: () => ({ primary: { camera: camDb['CAM-1'] }, alternatives: alts }),
      }),
    );
    expect((html.match(/camPickCard/g) || []).length).toBe(3);
  });

  it('mode expert → toutes les cartes', () => {
    const alts = ['CAM-2', 'CAM-3', 'CAM-4', 'CAM-5'].map((id) => ({ camera: { id, mp: 2, ir: 10 } }));
    const html = renderStepCameras(
      baseDeps({
        ui: { favorites: [], mode: 'expert', onlyFavs: false, compare: [] },
        buildRecoForBlock: () => ({ primary: { camera: camDb['CAM-1'] }, alternatives: alts }),
      }),
    );
    expect((html.match(/camPickCard/g) || []).length).toBe(5);
  });

  it('onlyFavs sans favori → message err_no_camera_display', () => {
    const html = renderStepCameras(
      baseDeps({ ui: { favorites: [], mode: 'simple', onlyFavs: true, compare: [] } }),
    );
    expect(html).toContain('i18n(err_no_fav)');
  });

  it('compare 1 caméra → carte en attente', () => {
    const html = renderStepCameras(
      baseDeps({ ui: { favorites: [], mode: 'simple', onlyFavs: false, compare: ['CAM-1'] } }),
    );
    expect(html).toContain('cmpCardWaiting');
    expect(html).toContain('data-action="uiClearCompare"');
  });

  it('compare 2 caméras → panneau de comparaison complet', () => {
    const html = renderStepCameras(
      baseDeps({
        ui: { favorites: [], mode: 'simple', onlyFavs: false, compare: ['CAM-1', 'CAM-2'] },
      }),
    );
    expect(html).toContain('cmpCard');
    expect(html).toContain('⇄ Comparaison');
    expect(html).toContain('Camera One');
    expect(html).toContain('Camera Two');
    expect(html).toContain('Portée DORI');
  });

  it('safeHtml échappe le label du bloc', () => {
    const html = renderStepCameras(
      baseDeps({ cameraBlocks: [baseBlock({ label: '<script>x</script>' })] }),
    );
    expect(html).not.toContain('<script>x</script>');
  });

  it('cameraBlocks vide → ne crash pas, rend la structure', () => {
    const html = renderStepCameras(baseDeps({ cameraBlocks: [], activeBlockId: null }));
    expect(html).toContain('stepSplit');
    expect(typeof html).toBe('string');
  });

  it('snapshot stable nominal', () => {
    expect(renderStepCameras(baseDeps())).toMatchSnapshot();
  });
});
