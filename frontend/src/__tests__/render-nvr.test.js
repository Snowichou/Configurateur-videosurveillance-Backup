// ============================================================
// Tests render/nvr.js — Étape NVR / Réseau (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepNvrNetwork } from '../render/nvr.js';

const baseProj = (overrides = {}) => ({
  totalCameras: 8,
  totalInMbps: 87,
  rawRequiredTB: 12.5,
  requiredTB: 12.5,
  storageCapped: false,
  disks: { count: 2, sizeTB: 8, maxTotalTB: 16, hddRef: { id: 'HDD-8', datasheet_url: '/data/hdd.pdf' } },
  switches: null,
  nvrPick: {
    nvr: {
      id: 'NVR-16',
      name: 'NVR ADVANCE 16ch',
      channels: 16,
      max_in_mbps: 160,
      hdd_bays: 2,
      brand_range: 'ADVANCE',
      image_url: '/img/nvr.png',
      datasheet_url: '/data/nvr.pdf',
    },
    alternatives: [],
  },
  ...overrides,
});

const baseDeps = (overrides = {}) => ({
  proj: baseProj(),
  isManual: false,
  T: (k) => `i18n(${k})`,
  localizedDatasheetUrl: (u) => `${u}?lang=fr`,
  ...overrides,
});

describe('renderStepNvrNetwork', () => {
  it('proj null → état vide', () => {
    const html = renderStepNvrNetwork(baseDeps({ proj: null }));
    expect(html).toContain('uiEmptyState');
    expect(html).toContain('i18n(err_compute)');
  });

  it('affiche les KPI principaux (canaux / débit / disques / To)', () => {
    const html = renderStepNvrNetwork(baseDeps());
    expect(html).toContain('8 / 16'); // cameras/channels
    expect(html).toContain('87 / 160'); // mbps/max
    expect(html).toContain('2 × 8 To'); // disks
    expect(html).toContain('12.5 To');
  });

  it('badge 🤖 IA si ADVANCE', () => {
    const html = renderStepNvrNetwork(baseDeps());
    expect(html).toContain('🤖 IA');
  });

  it('pas de badge IA si NEXT', () => {
    const proj = baseProj();
    proj.nvrPick.nvr.brand_range = 'NEXT';
    const html = renderStepNvrNetwork(baseDeps({ proj }));
    expect(html).not.toContain('🤖 IA');
  });

  it('isManual=true → affiche "(manuel)" + bouton reset', () => {
    const html = renderStepNvrNetwork(baseDeps({ isManual: true }));
    expect(html).toContain('(manuel)');
    expect(html).toContain('data-action="resetNvr"');
  });

  it('isManual=false → pas de bouton reset', () => {
    const html = renderStepNvrNetwork(baseDeps());
    expect(html).not.toContain('data-action="resetNvr"');
  });

  it('proj.nvrPick.nvr null → section warn "ajoute des NVR"', () => {
    const proj = baseProj();
    proj.nvrPick.nvr = null;
    const html = renderStepNvrNetwork(baseDeps({ proj }));
    expect(html).toContain('uiSectionWarn');
    expect(html).toContain('i18n(nvr_none)');
    expect(html).toContain('nvrs.csv');
  });

  it('storageCapped=true → bandeau warn + badge stockage rouge', () => {
    const proj = baseProj({ storageCapped: true });
    const html = renderStepNvrNetwork(baseDeps({ proj }));
    expect(html).toContain('nvr_storage_capped');
    expect(html).toContain('techBadgeWarn');
  });

  it('toutes les alternatives sont rendues', () => {
    const proj = baseProj();
    proj.nvrPick.alternatives = [
      { id: 'NVR-ADV-32', channels: 32, max_in_mbps: 320, hdd_bays: 8, brand_range: 'ADVANCE' },
      { id: 'NVR-NEXT-16', channels: 16, max_in_mbps: 240, hdd_bays: 4, brand_range: 'NEXT' },
    ];
    const html = renderStepNvrNetwork(baseDeps({ proj }));
    expect(html).toContain('NVR-ADV-32');
    expect(html).toContain('NVR-NEXT-16');
    expect(html).toContain('i18n(nvr_alternatives)');
    expect((html.match(/nvrAltCard/g) || []).length).toBe(2);
  });

  it('section PoE absente si pas de switch nécessaire et 0 ports NVR', () => {
    const html = renderStepNvrNetwork(baseDeps());
    expect(html).not.toContain('i18n(nvr_poe)');
  });

  it('switch requis : rend la section PoE avec dimensions', () => {
    const proj = baseProj({
      switches: {
        required: true,
        camerasOnSwitches: 8,
        totalPorts: 24,
        cameraDistribution: [
          { switch: { id: 'SW-24', poe_budget_w: 360, image_url: '/img/sw24.png' }, camerasConnected: 8, totalPorts: 24 },
        ],
      },
    });
    const html = renderStepNvrNetwork(baseDeps({ proj }));
    expect(html).toContain('i18n(nvr_poe)');
    expect(html).toContain('SW-24');
    expect(html).toContain('360W');
    expect(html).toContain('8 cam / 24 ports PoE');
  });

  it('datasheet URLs localisées', () => {
    const html = renderStepNvrNetwork(baseDeps());
    expect(html).toContain('/data/nvr.pdf?lang=fr');
    expect(html).toContain('/data/hdd.pdf?lang=fr');
  });

  it('snapshot stable nominal', () => {
    expect(renderStepNvrNetwork(baseDeps())).toMatchSnapshot();
  });

  it('snapshot stable proj null', () => {
    expect(renderStepNvrNetwork(baseDeps({ proj: null }))).toMatchSnapshot();
  });
});
