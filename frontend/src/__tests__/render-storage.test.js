// ============================================================
// Tests render/storage.js — Étape Stockage (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepStorage } from '../render/storage.js';
import { createInitialModel } from '../state/model.js';

const baseProj = () => ({
  rawRequiredTB: 12.5,
  requiredTB: 15.0,
  totalInMbps: 87.4,
  totalCameras: 8,
});

const baseDeps = () => ({
  model: createInitialModel(),
  proj: baseProj(),
  T: (k) => `i18n(${k})`,
  fpsOptions: [10, 15, 20, 25],
  storageTipHtml: () => '<div class="tip">tip-stub</div>',
  renderStorageBarSvg: () => '<svg class="bar">bar-stub</svg>',
});

describe('renderStepStorage', () => {
  it('retourne une string non vide', () => {
    const html = renderStepStorage(baseDeps());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(300);
  });

  it('affiche les KPI calculés (To, Mbps, caméras)', () => {
    const html = renderStepStorage(baseDeps());
    expect(html).toContain('12.5'); // rawRequiredTB.toFixed(1)
    expect(html).toContain('87.4'); // totalInMbps.toFixed(1)
    expect(html).toContain('8'); // totalCameras
  });

  it('utilise requiredTB en fallback si pas de rawRequiredTB', () => {
    const deps = baseDeps();
    delete deps.proj.rawRequiredTB;
    const html = renderStepStorage(deps);
    expect(html).toContain('15.0'); // requiredTB
  });

  it('affiche un état vide si proj null', () => {
    const deps = baseDeps();
    deps.proj = null;
    const html = renderStepStorage(deps);
    expect(html).toContain('uiEmptyState');
    expect(html).toContain('i18n(err_compute)');
    expect(html).toContain('i18n(err_no_camera)');
  });

  it('marque le FPS courant comme selected', () => {
    const deps = baseDeps();
    deps.model.recording.fps = 15;
    const html = renderStepStorage(deps);
    expect(html).toMatch(/<option value="15"\s+selected>15 FPS\s*★/);
  });

  it('mode motion : affiche le hint motion + select motion selected', () => {
    const deps = baseDeps();
    deps.model.recording.mode = 'motion';
    const html = renderStepStorage(deps);
    expect(html).toMatch(/<option value="motion"\s+selected>/);
    expect(html).toContain('i18n(stor_hint_motion)');
    expect(html).not.toContain('i18n(stor_hint_continuous)');
  });

  it('codec H.264 : affiche le hint h264', () => {
    const deps = baseDeps();
    deps.model.recording.codec = 'h264';
    const html = renderStepStorage(deps);
    expect(html).toMatch(/<option value="h264"\s+selected>/);
    expect(html).toContain('i18n(stor_hint_h264)');
  });

  it('dual stream OFF : affiche le hint OFF', () => {
    const deps = baseDeps();
    deps.model.recording.dualStream = false;
    const html = renderStepStorage(deps);
    expect(html).toContain('i18n(stor_dual_stream_hint_off)');
    expect(html).not.toContain('checked');
    // la classe "on" du switch ne doit pas être active
    expect(html).not.toMatch(/storageSwitch on/);
  });

  it('dual stream ON par défaut (undefined ≠ false)', () => {
    const html = renderStepStorage(baseDeps());
    expect(html).toContain('i18n(stor_dual_stream_hint_on)');
    expect(html).toMatch(/storageSwitch on/);
    expect(html).toContain('checked');
  });

  it('injecte storageTipHtml et renderStorageBarSvg', () => {
    const html = renderStepStorage(baseDeps());
    expect(html).toContain('tip-stub');
    expect(html).toContain('bar-stub');
  });

  it('utilise fpsOptions injectées', () => {
    const deps = baseDeps();
    deps.fpsOptions = [5, 30];
    const html = renderStepStorage(deps);
    expect(html).toContain('<option value="5"');
    expect(html).toContain('<option value="30"');
    expect(html).not.toContain('<option value="15"');
  });

  it('fallback FPS [10,12,15,20,25] si fpsOptions absent', () => {
    const deps = baseDeps();
    delete deps.fpsOptions;
    const html = renderStepStorage(deps);
    expect(html).toContain('<option value="10"');
    expect(html).toContain('<option value="25"');
  });

  it('snapshot stable du rendu par défaut', () => {
    const html = renderStepStorage(baseDeps());
    expect(html).toMatchSnapshot();
  });

  it('snapshot stable du rendu motion + h264 + dualStream OFF', () => {
    const deps = baseDeps();
    deps.model.recording.mode = 'motion';
    deps.model.recording.codec = 'h264';
    deps.model.recording.dualStream = false;
    deps.model.recording.fps = 10;
    const html = renderStepStorage(deps);
    expect(html).toMatchSnapshot();
  });
});
