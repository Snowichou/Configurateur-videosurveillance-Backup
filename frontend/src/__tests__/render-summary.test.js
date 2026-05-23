// ============================================================
// Tests render/summary.js — Étape Récap finale (HTML pur)
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderStepSummary } from '../render/summary.js';

const T = (k) => `i18n(${k})`;

describe('renderStepSummary', () => {
  it('proj null → bannière warn + config incomplète', () => {
    const html = renderStepSummary({ proj: null, T });
    expect(html).toContain('summaryBanner warn');
    expect(html).toContain('⚠️');
    expect(html).toContain('i18n(sum_config_incomplete)');
  });

  it('proj null → pas de barre d\'export', () => {
    const html = renderStepSummary({ proj: null, T });
    expect(html).not.toContain('summaryActions');
    expect(html).not.toContain('btnExportPdf');
  });

  it('proj null → corps placeholder', () => {
    const html = renderStepSummary({ proj: null, T });
    expect(html).toContain('recoCard');
  });

  it('proj présent → bannière ok + config finalisée', () => {
    const html = renderStepSummary({ proj: {}, finalSummaryHtml: '<div>RECAP</div>', T });
    expect(html).toContain('summaryBanner ok');
    expect(html).toContain('✅');
    expect(html).toContain('i18n(sum_config_done)');
    expect(html).toContain('i18n(sum_config_done_desc)');
  });

  it('proj présent → barre d\'export complète', () => {
    const html = renderStepSummary({ proj: {}, finalSummaryHtml: '', T });
    expect(html).toContain('summaryActions');
    expect(html).toContain('btnExportPdf');
    expect(html).toContain('btnExportPdfPack');
    expect(html).toContain('btnPreviewPdf');
    expect(html).toContain('btnRequestQuote');
    expect(html).toContain('btnSaveConfig');
    expect(html).toContain('btnShareConfig');
    expect(html).toContain('btnBackToEdit');
  });

  it('proj présent → injecte finalSummaryHtml', () => {
    const html = renderStepSummary({ proj: {}, finalSummaryHtml: '<div id="MARKER">x</div>', T });
    expect(html).toContain('<div id="MARKER">x</div>');
  });

  it('libellés export traduits via T', () => {
    const html = renderStepSummary({ proj: {}, finalSummaryHtml: '', T });
    expect(html).toContain('i18n(sum_export_pdf)');
    expect(html).toContain('i18n(sum_export_pack)');
    expect(html).toContain('i18n(sum_request_quote)');
  });

  it('T absent → fallback identité (pas de crash)', () => {
    const html = renderStepSummary({ proj: {}, finalSummaryHtml: '' });
    expect(html).toContain('sum_config_done');
    expect(typeof html).toBe('string');
  });

  it('deps vide → état warn par défaut', () => {
    const html = renderStepSummary();
    expect(html).toContain('summaryBanner warn');
  });

  it('snapshot stable nominal', () => {
    expect(
      renderStepSummary({ proj: {}, finalSummaryHtml: '<div>RECAP</div>', T }),
    ).toMatchSnapshot();
  });

  it('snapshot stable proj null', () => {
    expect(renderStepSummary({ proj: null, T })).toMatchSnapshot();
  });
});
