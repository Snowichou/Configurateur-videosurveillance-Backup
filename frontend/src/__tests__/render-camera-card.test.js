// ============================================================
// Tests render/camera-card.js — Carte caméra recommandée (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderCameraPickCard } from '../render/camera-card.js';

const T = (k) => `i18n(${k})`;
const CLR = { green: '#0f0', okBg: '#efe', danger: '#f00', dangerBg: '#fee' };

const baseCam = (o = {}) => ({
  id: 'CAM-1',
  name: 'Camera One',
  type: 'turret',
  resolution_mp: 4,
  ir_range_m: 30,
  ip: 67,
  brand_range: 'NEXT',
  datasheet_url: '/data/cam.pdf',
  ...o,
});

const deps = (interp = { score: 92, level: 'ok', message: 'Parfait' }, over = {}) => ({
  interpretScoreForBlock: () => interp,
  T,
  CLR,
  localizedDatasheetUrl: (u) => `${u}?lang=fr`,
  compare: [],
  ...over,
});

describe('renderCameraPickCard', () => {
  it('cam null → chaîne vide', () => {
    expect(renderCameraPickCard({}, null, deps())).toBe('');
  });

  it('rend id, nom et score de la caméra', () => {
    const html = renderCameraPickCard({}, baseCam(), deps());
    expect(html).toContain('CAM-1');
    expect(html).toContain('Camera One');
    expect(html).toContain('>92<');
    expect(html).toContain('cameraPickCard');
  });

  it('niveau ok → bordure verte + verdict optimal (score ≥ 90)', () => {
    const html = renderCameraPickCard({}, baseCam(), deps({ score: 95, level: 'ok' }));
    expect(html).toContain('border-left:4px solid #0f0');
    expect(html).toContain('i18n(cam_optimal)');
    expect(html).toContain('lvl-ok');
  });

  it('niveau bad → bordure danger + verdict non adapté', () => {
    const html = renderCameraPickCard({}, baseCam(), deps({ score: 30, level: 'bad' }));
    expect(html).toContain('border-left:4px solid #f00');
    expect(html).toContain('i18n(cam_not_adapted)');
  });

  it('image présente → balise img', () => {
    const html = renderCameraPickCard({}, baseCam({ image_url: '/img/c.png' }), deps());
    expect(html).toContain('<img class="cameraPickImg" src="/img/c.png"');
  });

  it('image absente → placeholder 📷', () => {
    const html = renderCameraPickCard({}, baseCam({ image_url: '' }), deps());
    expect(html).toContain('📷');
  });

  it('caméra validée → badge sélectionnée + bouton "sélectionnée"', () => {
    const blk = { validated: true, selectedCameraId: 'CAM-1' };
    const html = renderCameraPickCard(blk, baseCam(), deps());
    expect(html).toContain('i18n(cam_selected)');
    expect(html).toContain('i18n(cam_camera_selected)');
  });

  it('non validée → bouton "choisir"', () => {
    const html = renderCameraPickCard({}, baseCam(), deps());
    expect(html).toContain('i18n(cam_choose_camera)');
    expect(html).not.toContain('i18n(cam_camera_selected)');
  });

  it('datasheet → lien localisé', () => {
    const html = renderCameraPickCard({}, baseCam(), deps());
    expect(html).toContain('/data/cam.pdf?lang=fr');
    expect(html).toContain('i18n(btn_datasheet)');
  });

  it('sans datasheet → pas de lien fiche', () => {
    const html = renderCameraPickCard({}, baseCam({ datasheet_url: '' }), deps());
    expect(html).not.toContain('btnDatasheet');
  });

  it('caméra en comparaison → bouton actif "✓ Comparé"', () => {
    const html = renderCameraPickCard({}, baseCam(), deps(undefined, { compare: ['CAM-1'] }));
    expect(html).toContain('btnCompare active');
    expect(html).toContain('✓ Comparé');
  });

  it('caméra hors comparaison → bouton "⇄ Comparer"', () => {
    const html = renderCameraPickCard({}, baseCam(), deps());
    expect(html).toContain('⇄ Comparer');
  });

  it('badge IA Intrusion si gamme NEXT + analytics', () => {
    const html = renderCameraPickCard({}, baseCam({ brand_range: 'NEXT', analytics_level: 'IA' }), deps());
    expect(html).toContain('IA Intrusion');
  });

  it('badge IA Avancée si gamme ADVANCE + analytics', () => {
    const html = renderCameraPickCard(
      {},
      baseCam({ brand_range: 'ADVANCE', ai_features: 'yes' }),
      deps(),
    );
    expect(html).toContain('IA Avancée');
  });

  it('pas de badge IA si aucune analytics', () => {
    const html = renderCameraPickCard({}, baseCam(), deps());
    expect(html).not.toContain('🤖');
  });

  it('safeHtml échappe le nom de la caméra', () => {
    const html = renderCameraPickCard({}, baseCam({ name: '<script>x</script>' }), deps());
    expect(html).not.toContain('<script>x</script>');
  });

  it('snapshot stable', () => {
    expect(renderCameraPickCard({}, baseCam(), deps())).toMatchSnapshot();
  });
});
