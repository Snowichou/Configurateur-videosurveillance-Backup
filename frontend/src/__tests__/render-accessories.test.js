// ============================================================
// Tests render/accessories.js — Étape Fixations (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepAccessories } from '../render/accessories.js';

const baseDeps = () => ({
  blocks: [],
  T: (k) => `i18n(${k})`,
  normalizeEmplacement: (v) => String(v || '').toLowerCase(),
  accessoryTypeLabel: (t) => `type:${t}`,
  localizedDatasheetUrl: (u) => `${u}?lang=fr`,
});

const sampleBlock = (overrides = {}) => ({
  id: 'B1',
  label: 'Bloc parking',
  qty: 4,
  validated: true,
  answers: { use_case: 'Parking', emplacement: 'exterieur' },
  camera: { id: 'CAM-1', name: 'Dome 4MP' },
  accessories: [
    {
      accessoryId: 'JB-1',
      name: 'Junction box',
      type: 'junction_box',
      qty: 2,
      image_url: '/img/jb1.png',
      datasheet_url: '/data/jb1.pdf',
    },
  ],
  ...overrides,
});

describe('renderStepAccessories', () => {
  it('aucun bloc validé → état vide', () => {
    const html = renderStepAccessories(baseDeps());
    expect(html).toContain('uiEmptyState');
    expect(html).toContain('i18n(err_no_block)');
  });

  it('rend une section par bloc validé', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock(), sampleBlock({ id: 'B2', label: 'Bloc hall' })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('Bloc parking');
    expect(html).toContain('Bloc hall');
    expect((html.match(/uiSection\b/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('affiche les meta du bloc (qté, emplacement, use_case)', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock()];
    const html = renderStepAccessories(deps);
    expect(html).toContain('4×');
    expect(html).toContain('i18n(cam_exterior)');
    expect(html).toContain('Parking');
  });

  it('fallback "intérieur" quand emplacement = interieur', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock({ answers: { use_case: 'Bureau', emplacement: 'interieur' } })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('i18n(cam_interior)');
    expect(html).not.toContain('i18n(cam_exterior)');
  });

  it('rend les accessoires avec qty, ref et datasheet', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock()];
    const html = renderStepAccessories(deps);
    expect(html).toContain('Junction box');
    expect(html).toContain('JB-1');
    expect(html).toContain('value="2"'); // qty
    expect(html).toContain('/data/jb1.pdf?lang=fr'); // datasheet localisée
    expect(html).toContain('i18n(btn_datasheet)');
  });

  it('utilise accessoryTypeLabel injecté', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock()];
    const html = renderStepAccessories(deps);
    expect(html).toContain('type:junction_box');
  });

  it('bloc sans accessoires → message vide spécifique', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock({ accessories: [] })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('Aucun accessoire trouvé');
  });

  it('image_url manquante → placeholder 📷', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock({ accessories: [{ accessoryId: 'X', type: 'x', qty: 1 }] })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('uiProductImgPh');
    expect(html).toContain('📷');
  });

  it('label vide → fallback sur le nom caméra', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock({ label: '', camera: { id: 'X', name: 'Bullet IR' } })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('Bullet IR');
  });

  it('label vide + caméra null → "Bloc caméra" par défaut', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock({ label: '', camera: null })];
    const html = renderStepAccessories(deps);
    expect(html).toContain('Bloc caméra');
  });

  it('échappe les valeurs dans label / accessoires', () => {
    const deps = baseDeps();
    deps.blocks = [
      sampleBlock({
        label: '<script>',
        accessories: [{ accessoryId: '<x>', name: '<y>', type: 'z', qty: 1 }],
      }),
    ];
    const html = renderStepAccessories(deps);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;y&gt;');
  });

  it('inclut le bouton recalcAccessories dans l\'intro', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock()];
    const html = renderStepAccessories(deps);
    expect(html).toContain('data-action="recalcAccessories"');
    expect(html).toContain('i18n(mount_recalculate)');
  });

  it('snapshot stable empty', () => {
    expect(renderStepAccessories(baseDeps())).toMatchSnapshot();
  });

  it('snapshot stable avec 1 bloc / 1 accessoire', () => {
    const deps = baseDeps();
    deps.blocks = [sampleBlock()];
    expect(renderStepAccessories(deps)).toMatchSnapshot();
  });
});
