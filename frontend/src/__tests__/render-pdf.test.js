// render/pdf.test.js -- Tests Vitest pour render/pdf.js
import { describe, it, expect, vi } from 'vitest';
import { buildPdfHtmlPure } from '../render/pdf.js';

const makeT = () => (key) => `[${key}]`;
const makeDeps = (overrides = {}) => ({
  T: makeT(),
  currentLang: 'fr',
  safeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  computeCriticalProjectScore: () => null,
  generateQRDataUrl: () => '',
  generateShareUrl: () => '',
  getCameraById: () => null,
  getSelectedOrRecommendedEnclosure: () => null,
  getSelectedOrRecommendedScreen: () => null,
  getSelectedOrRecommendedSign: () => null,
  getThumbSrc: () => '',
  interpretScoreForBlock: () => ({ level: 'ok', label: 'OK' }),
  CATALOG: { CAMERAS:[], NVRS:[], HDDS:[], SWITCHES:[], ACCESSORIES:[], SCREENS:[], ENCLOSURES:[], SIGNAGE:[] },
  MODEL: {
    projectName: 'Projet Test',
    cameraLines: [], cameraBlocks: [], recording: {},
    nvrPick: null, totalInMbps: 0, hddPlan: null, accessories: {}, ui: {},
  },
  ...overrides,
});
const makeProj = (overrides = {}) => ({
  projectName: 'Mon Projet',
  cameraBlocks: [], cameraLines: [], recording: { mode: 'continuous' },
  nvrPick: null, hddPlan: null, accessories: {},
  ...overrides,
});

describe('buildPdfHtmlPure -- structure de base', () => {
  it('retourne une chaine non vide', () => {
    const html = buildPdfHtmlPure(makeProj(), makeDeps());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });
  it('commence par une balise div', () => {
    expect(buildPdfHtmlPure(makeProj(), makeDeps()).trimStart()).toMatch(/^<div/);
  });
  it('contient la classe pdfPage', () => {
    expect(buildPdfHtmlPure(makeProj(), makeDeps())).toContain('pdfPage');
  });
  it('contient un bloc style avec CSS PDF', () => {
    const html = buildPdfHtmlPure(makeProj(), makeDeps());
    expect(html).toContain('<style>');
    expect(html).toContain('.pdfPage');
  });
});

describe('buildPdfHtmlPure -- nom de projet', () => {
  it('affiche proj.projectName', () => {
    expect(buildPdfHtmlPure(makeProj({ projectName: 'Site Alpha' }), makeDeps())).toContain('Site Alpha');
  });
  it('utilise MODEL.projectName si proj.projectName est null', () => {
    const deps = makeDeps({ MODEL: { ...makeDeps().MODEL, projectName: 'Depuis MODEL' } });
    expect(buildPdfHtmlPure(makeProj({ projectName: null }), deps)).toContain('Depuis MODEL');
  });
  it('affiche tirets si aucun nom disponible', () => {
    const deps = makeDeps({ MODEL: { ...makeDeps().MODEL, projectName: '' } });
    expect(buildPdfHtmlPure(makeProj({ projectName: '' }), deps)).toContain('—');
  });
});

describe('buildPdfHtmlPure -- traduction (T)', () => {
  it('appelle T() et inclut le resultat dans le HTML', () => {
    const T = vi.fn((key) => `TRAD_${key}`);
    const html = buildPdfHtmlPure(makeProj(), makeDeps({ T }));
    expect(T).toHaveBeenCalled();
    expect(html).toContain(`TRAD_${T.mock.calls[0][0]}`);
  });
  it('contient T("pdf_project_summary")', () => {
    expect(buildPdfHtmlPure(makeProj(), makeDeps())).toContain('[pdf_project_summary]');
  });
  it('contient T("pdf_cameras")', () => {
    expect(buildPdfHtmlPure(makeProj(), makeDeps())).toContain('[pdf_cameras]');
  });
});

describe('buildPdfHtmlPure -- safeHtml', () => {
  it('echappe les balises HTML dans le nom de projet', () => {
    const html = buildPdfHtmlPure(makeProj({ projectName: '<script>xss</script>' }), makeDeps());
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('fonctionne sans safeHtml (fallback String())', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ safeHtml: undefined }))).not.toThrow();
  });
});

describe('buildPdfHtmlPure -- computeCriticalProjectScore', () => {
  it('fonctionne sans la dep', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ computeCriticalProjectScore: undefined }))).not.toThrow();
  });
  it('appelle la dep quand fournie', () => {
    const fn = vi.fn(() => ({ level: 'critical', score: 42 }));
    buildPdfHtmlPure(makeProj(), makeDeps({ computeCriticalProjectScore: fn }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('buildPdfHtmlPure -- QR code', () => {
  it('fonctionne sans generateShareUrl', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ generateShareUrl: undefined }))).not.toThrow();
  });
  it('appelle generateQRDataUrl si URL < 4000 chars', () => {
    const shareUrl = vi.fn(() => 'https://example.com/share');
    const qrFn = vi.fn(() => 'data:image/png;base64,ABC');
    buildPdfHtmlPure(makeProj(), makeDeps({ generateShareUrl: shareUrl, generateQRDataUrl: qrFn }));
    expect(shareUrl).toHaveBeenCalled();
    expect(qrFn).toHaveBeenCalled();
  });
  it('ne appelle pas generateQRDataUrl si URL >= 4000 chars', () => {
    const shareUrl = vi.fn(() => 'x'.repeat(4001));
    const qrFn = vi.fn(() => '');
    buildPdfHtmlPure(makeProj(), makeDeps({ generateShareUrl: shareUrl, generateQRDataUrl: qrFn }));
    expect(qrFn).not.toHaveBeenCalled();
  });
});

describe('buildPdfHtmlPure -- currentLang', () => {
  it('accepte en', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ currentLang: 'en' }))).not.toThrow();
  });
  it('accepte de', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ currentLang: 'de' }))).not.toThrow();
  });
  it('utilise fr par defaut si lang inconnu', () => {
    expect(() => buildPdfHtmlPure(makeProj(), makeDeps({ currentLang: 'xx' }))).not.toThrow();
  });
});

describe('buildPdfHtmlPure -- blocs camera', () => {
  const block = {
    id: 'b1', label: 'Zone Entree', validated: true,
    answers: { objective: 'identification', emplacement: 'exterieur' },
  };
  const depsWithBlock = makeDeps({
    MODEL: { ...makeDeps().MODEL, cameraBlocks: [block], cameraLines: [] },
  });

  it('ne plante pas avec un bloc minimal', () => {
    expect(() => buildPdfHtmlPure(makeProj(), depsWithBlock)).not.toThrow();
  });
  it('contient le label du bloc', () => {
    expect(buildPdfHtmlPure(makeProj(), depsWithBlock)).toContain('Zone Entree');
  });
  it('ignore les blocs non valides', () => {
    const deps = makeDeps({
      MODEL: { ...makeDeps().MODEL, cameraBlocks: [{ ...block, label: 'Bloc Ignore', validated: false }] },
    });
    expect(buildPdfHtmlPure(makeProj(), deps)).not.toContain('Bloc Ignore');
  });
});
