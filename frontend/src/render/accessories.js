// ============================================================
// render/accessories.js — Étape Fixations / Accessoires
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). HTML pur.
//
// Le caller passe les blocs caméra validés enrichis avec leur caméra
// résolue (camForBlock) — ainsi le module ne dépend ni de MODEL.cameraLines
// ni de getCameraById.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

const identityT = (k) => String(k ?? '');

/**
 * Rendu d'une ligne d'accessoire (helper interne).
 */
function buildAccessoryLine(acc, li, blkId, deps) {
  const { T, sh, accessoryTypeLabel, localizedDatasheetUrl } = deps;
  return `
    <div class="uiProductCard">
      <div class="uiProductMain">
        <div class="uiProductInfo">
          <div class="uiProductTitle">${sh(acc.name || acc.accessoryId)}</div>
          <div class="uiProductMeta">${sh(accessoryTypeLabel(acc.type))}${acc.accessoryId ? ` • <strong>${sh(acc.accessoryId)}</strong>` : ''}</div>
          ${acc.datasheet_url ? `<a class="uiLink" href="${localizedDatasheetUrl(acc.datasheet_url)}" target="_blank" rel="noreferrer">${T('btn_datasheet')}</a>` : ''}
        </div>
        ${acc.image_url ? `<img class="uiProductImg" src="${acc.image_url}" alt="" loading="lazy">` : '<div class="uiProductImgPh">📷</div>'}
      </div>
      <div class="uiProductActions">
        <div class="uiInputGroup">
          <label class="uiInputLabel">${T('opt_qty')}</label>
          <input data-action="accQty" data-bid="${sh(blkId)}" data-li="${li}"
            type="number" min="1" max="999" value="${acc.qty}" class="uiInput uiInputSm" />
        </div>
        <button data-action="accDelete" data-bid="${sh(blkId)}" data-li="${li}"
          class="uiBtnGhost uiBtnDanger" type="button">${T('btn_remove')}</button>
      </div>
    </div>
  `;
}

/**
 * Rendu de l'étape Accessoires (fixations).
 *
 * @param {Object}   deps
 * @param {Array<Object>} deps.blocks               - Blocs validés (chacun avec .camera enrichi)
 * @param {Function} [deps.T=identity]
 * @param {Function} [deps.safeHtml]
 * @param {Function} [deps.normalizeEmplacement]    - (v) → "interieur"|"exterieur"|""
 * @param {Function} [deps.accessoryTypeLabel]      - (type) → label i18n
 * @param {Function} [deps.localizedDatasheetUrl]   - (url) → url adaptée locale
 * @returns {string} HTML
 */
export function renderStepAccessories(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;
  const normalizeEmplacement =
    typeof deps.normalizeEmplacement === 'function'
      ? deps.normalizeEmplacement
      : (v) => String(v || '').toLowerCase();
  const accessoryTypeLabel =
    typeof deps.accessoryTypeLabel === 'function' ? deps.accessoryTypeLabel : (t) => String(t || '');
  const localizedDatasheetUrl =
    typeof deps.localizedDatasheetUrl === 'function' ? deps.localizedDatasheetUrl : (u) => u;

  const blocks = Array.isArray(deps.blocks) ? deps.blocks : [];

  if (!blocks.length) {
    return `
      <div class="uiEmptyState">
        <div class="uiEmptyIcon">🔌</div>
        <div class="uiEmptyTitle">${T('err_no_block')}</div>
        <div class="uiEmptyMsg">${T('err_no_block')}</div>
      </div>
    `;
  }

  const blocksHtml = blocks
    .map((blk) => {
      const cam = blk.camera || null;
      const lines = blk.accessories || [];
      const emplLabel =
        normalizeEmplacement(blk.answers?.emplacement) === 'exterieur'
          ? T('cam_exterior')
          : T('cam_interior');

      const innerDeps = { T, sh, accessoryTypeLabel, localizedDatasheetUrl };
      const linesHtml = lines.length
        ? lines.map((acc, li) => buildAccessoryLine(acc, li, blk.id, innerDeps)).join('')
        : `<div class="uiMuted">Aucun accessoire trouvé pour ce bloc.</div>`;

      return `
        <div class="uiSection">
          <div class="uiSectionHeader">
            <div class="uiSectionIcon">🎥</div>
            <div>
              <div class="uiSectionTitle">${sh(blk.label || cam?.name || 'Bloc caméra')}</div>
              <div class="uiSectionMeta">${blk.qty || 1}× • ${sh(emplLabel)} • ${sh(blk.answers?.use_case || '—')}</div>
            </div>
            <div class="uiBadge">ACC</div>
          </div>
          <div class="uiSectionBody">
            ${linesHtml}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="uiStepIntro">
      <div class="uiStepIntroIcon">🔧</div>
      <div>
        <div class="uiStepIntroTitle">${T('mount_title')}</div>
        <div class="uiStepIntroMsg">${T('mount_desc')}</div>
      </div>
      <button data-action="recalcAccessories" type="button" class="uiBtn uiBtnSm">${'♻️ ' + T('mount_recalculate')}</button>
    </div>

    <div class="uiSectionsGrid">
      ${blocksHtml}
    </div>
  `;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
