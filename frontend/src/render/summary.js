// ============================================================
// render/summary.js — Étape Récap finale
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). HTML pur.
//
// Le caller passe `proj` (projet calculé final) et `finalSummaryHtml`
// (pré-rendu via renderFinalSummary — qui reste dans app.js car il
// agrège beaucoup d'autres render*).
// ============================================================

const identityT = (k) => String(k ?? '');

/**
 * Barre d'actions d'export (visible seulement si projet finalisé).
 */
function buildExportActions(T) {
  return `
    <div class="summaryActions">
      <div class="summaryActionsRow">
        <button class="exportBtn exportBtnMain" id="btnExportPdf">
          <span class="exportBtnIcon">📄</span>
          <span class="exportBtnLabel">${T('sum_export_pdf')}</span>
        </button>
        <button class="exportBtn exportBtnSecondary" id="btnExportPdfPack">
          <span class="exportBtnIcon">📦</span>
          <span class="exportBtnLabel">${T('sum_export_pack')}</span>
        </button>
        <button class="exportBtn exportBtnSecondary" id="btnPreviewPdf">
          <span class="exportBtnIcon">👁️</span>
          <span class="exportBtnLabel">${T('proj_preview')}</span>
        </button>
      </div>
      <div class="summaryActionsRow">
        <button class="exportBtn exportBtnCommercial" id="btnRequestQuote">
          <span class="exportBtnIcon">✉️</span>
          <span class="exportBtnLabel">${T('sum_request_quote')}</span>
        </button>
      </div>
      <div class="summaryActionsRow summaryActionsUtils">
        <button class="exportBtn exportBtnSecondary" id="btnSaveConfig">
          <span class="exportBtnIcon">💾</span>
          <span class="exportBtnLabel">${T('sum_save')}</span>
        </button>
        <button class="exportBtn exportBtnSecondary" id="btnShareConfig">
          <span class="exportBtnIcon">🔗</span>
          <span class="exportBtnLabel">${T('sum_share')}</span>
        </button>
        <button class="exportBtn exportBtnGhost" id="btnBackToEdit">
          <span class="exportBtnIcon">✏️</span>
          <span class="exportBtnLabel">${T('btn_edit_config')}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Rendu de l'étape Récap.
 *
 * @param {Object}  deps
 * @param {Object|null} deps.proj                 - Projet finalisé (LAST_PROJECT). null = config incomplete.
 * @param {string}  [deps.finalSummaryHtml='']    - HTML pré-rendu du résumé détaillé
 * @param {Function} [deps.T=identity]
 * @returns {string} HTML
 */
export function renderStepSummary(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const proj = deps.proj || null;
  const finalSummaryHtml = typeof deps.finalSummaryHtml === 'string' ? deps.finalSummaryHtml : '';

  const bannerClass = proj ? 'ok' : 'warn';
  const bannerIcon = proj ? '✅' : '⚠️';
  const bannerTitle = proj ? T('sum_config_done') : T('sum_config_incomplete');
  const bannerSub = proj
    ? T('sum_config_done_desc')
    : "Reviens à l'étape Options et clique Finaliser.";

  const exportSection = proj ? buildExportActions(T) : '';
  const summaryBody = proj
    ? finalSummaryHtml
    : `<div class="recoCard" style="padding:12px"><div class="muted">—</div></div>`;

  return `
    <div class="step stepSummary">
      <div class="summaryBanner ${bannerClass}">
        <div class="summaryBannerIcon">${bannerIcon}</div>
        <div class="summaryBannerText">
          <div class="summaryBannerTitle">${bannerTitle}</div>
          <div class="summaryBannerSub">${bannerSub}</div>
        </div>
      </div>

      ${exportSection}

      <div class="summaryFullWidth">
        ${summaryBody}
      </div>
    </div>
  `;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
