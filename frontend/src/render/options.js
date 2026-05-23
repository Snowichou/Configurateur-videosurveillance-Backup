// ============================================================
// render/options.js — Étape Compléments (écran/boîtier/signalétique)
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Pure HTML.
//
// Le caller (app.js) calcule en amont :
//   - selections.screen      { selected, sizeInch, qty, enabled }
//   - selections.enclosure   { selected, qty, enabled, screenInsideOk, screenSizeInch }
//   - selections.signage     { selected, scope, qty, enabled }
//
// Les helpers HTML (optionTipHtml) sont injectés en deps.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

const identityT = (k) => String(k ?? '');

/**
 * Carte d'une option (écran / boîtier / signalétique).
 * Helper interne — non exporté.
 */
function buildOptionCard({
  icon,
  title,
  desc,
  enabled,
  toggleAction,
  toggleValue,
  body,
  tipHtml,
  T,
  safeHtml: sh,
}) {
  return `
    <div class="optCard ${enabled ? 'optCardActive' : ''}">
      <div class="optHeader">
        <div class="optHeaderLeft">
          <div class="optIcon">${icon}</div>
          <div class="optHeaderTxt">
            <div class="optTitle">${title}</div>
            <div class="optDesc">${desc}</div>
          </div>
        </div>
        <div class="optHeaderRight">
          <span class="optStateLabel ${enabled ? 'optStateOn' : 'optStateOff'}" aria-hidden="true">
            ${enabled ? sh(T('opt_state_on')) : sh(T('opt_state_off'))}
          </span>
          <button data-action="${toggleAction}" data-value="${toggleValue}"
            class="optToggle ${enabled ? 'optToggleOn' : ''}"
            aria-pressed="${enabled ? 'true' : 'false'}"
            aria-label="${sh(enabled ? T('opt_toggle_disable') : T('opt_toggle_enable'))}"
            title="${sh(enabled ? T('opt_toggle_disable') : T('opt_toggle_enable'))}">
            <span class="optToggleDot"></span>
          </button>
        </div>
      </div>
      ${
        enabled
          ? `<div class="optBody">${tipHtml || ''}${body}</div>`
          : `<div class="optBodyDisabled">${sh(T('opt_disabled_hint'))}</div>`
      }
    </div>`;
}

/**
 * Ligne produit (référence + nom + image + badges).
 * Helper interne.
 */
function buildProductRow(ref, name, imgUrl, imgFallback, badges, sh) {
  const badgesHtml = (badges || [])
    .map(
      (b) =>
        `<span class="optBadge${b.type === 'ok' ? ' optBadgeOk' : b.type === 'warn' ? ' optBadgeWarn' : ''}">${b.text}</span>`
    )
    .join('');
  return `<div class="optProduct">
    <div class="optProductInfo">
      <div class="optProductRef">${sh(ref)}</div>
      <div class="optProductName">${sh(name)}</div>
      ${badgesHtml ? `<div class="optBadges">${badgesHtml}</div>` : ''}
    </div>
    ${imgUrl ? `<img class="optProductImg" src="${imgUrl}" alt="" loading="lazy">` : `<div class="optProductImgPh">${imgFallback}</div>`}
  </div>`;
}

/**
 * Rendu de l'étape Compléments.
 *
 * @param {Object}   deps
 * @param {Object}   deps.proj                 - projet calculé (null = état vide)
 * @param {Object}   deps.selections           - { screen, enclosure, signage } pré-calculés
 * @param {Function} [deps.T=identity]
 * @param {Function} [deps.safeHtml]
 * @param {number[]} [deps.screenSizes=[18,22,27,32,43,55]]
 * @param {Function} [deps.optionTipHtml]      - (key) → html astuce
 * @returns {string} HTML
 */
export function renderStepComplements(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;

  if (!deps.proj) {
    return `<div class="uiEmptyState"><div class="uiEmptyIcon">⚠️</div><div class="uiEmptyTitle">${T('err_compute')}</div></div>`;
  }

  const sel = deps.selections || {};
  const screen = sel.screen || {};
  const enclosure = sel.enclosure || {};
  const signage = sel.signage || {};

  const screenSizes = Array.isArray(deps.screenSizes) && deps.screenSizes.length
    ? deps.screenSizes
    : [18, 22, 27, 32, 43, 55];
  const optionTipHtml =
    typeof deps.optionTipHtml === 'function' ? deps.optionTipHtml : () => '';

  // ─── Écran body ────────────────────────────────────────────
  const screenSizeOptions = screenSizes
    .map((s) => `<option value="${s}"${screen.sizeInch === s ? ' selected' : ''}>${s}"</option>`)
    .join('');
  const screenBody =
    `<div class="optForm">
      <div class="optFormRow">
        <div class="optFormField">
          <label class="optLabel">${T('opt_screen_size')}</label>
          <select data-action="screenSize" class="optInput">${screenSizeOptions}</select>
        </div>
        <div class="optFormField">
          <label class="optLabel">${T('opt_qty')}</label>
          <input data-action="screenQty" type="number" min="1" max="10" value="${screen.qty || 1}" class="optInput optInputNarrow" />
        </div>
      </div>
    </div>` +
    (screen.selected
      ? buildProductRow(screen.selected.id, screen.selected.name || '', screen.selected.image_url, '🖥️', [], sh)
      : '');

  // ─── Boîtier body (+ compat écran enrichie) ────────────────
  const encBadges = [];
  let encCompatExplainHtml = '';
  if (enclosure.enabled && screen.enabled) {
    if (enclosure.screenInsideOk) {
      encBadges.push({ type: 'ok', text: T('opt_enclosure_screen_ok') });
    } else {
      encBadges.push({ type: 'warn', text: T('opt_enclosure_screen_no') });
      const encMaxScreen = enclosure.selected?.screen_compatible_with || enclosure.selected?.max_screen_inch || '';
      encCompatExplainHtml = `
        <div class="optCompatExplain">
          <div class="optCompatExplainHeader">⚠️ ${sh(T('opt_compat_warn_title'))}</div>
          <div class="optCompatExplainBody">
            ${T('opt_compat_warn_body')
              .replace('{0}', String(enclosure.screenSizeInch || 0))
              .replace('{1}', sh(enclosure.selected?.id || '—'))
              .replace('{2}', sh(encMaxScreen || T('opt_compat_unknown')))}
          </div>
          <div class="optCompatExplainTip">💡 ${sh(T('opt_compat_suggest'))}</div>
        </div>
      `;
    }
  }
  const encBody =
    `<div class="optForm">
      <div class="optFormRow">
        <div class="optFormField">
          <label class="optLabel">${T('opt_qty')}</label>
          <input data-action="enclosureQty" type="number" min="1" max="10" value="${enclosure.qty || 1}" class="optInput optInputNarrow" />
        </div>
      </div>
    </div>` +
    (enclosure.selected
      ? buildProductRow(enclosure.selected.id, enclosure.selected.name || '', enclosure.selected.image_url, '📦', encBadges, sh)
      : !enclosure.enabled
        ? ''
        : `<div class="optNoProduct">${T('opt_enclosure_none')}</div>`) +
    encCompatExplainHtml;

  // ─── Signalétique body ─────────────────────────────────────
  const signScope = signage.scope || 'Public';
  const signBody =
    `<div class="optForm">
      <div class="optFormRow">
        <div class="optFormField">
          <label class="optLabel">${T('opt_sign_scope')}</label>
          <select data-action="signageScope" class="optInput">
            <option value="Public"${signScope === 'Public' ? ' selected' : ''}>${T('opt_sign_public')}</option>
            <option value="Privé"${signScope === 'Privé' ? ' selected' : ''}>${T('opt_sign_private')}</option>
          </select>
        </div>
        <div class="optFormField">
          <label class="optLabel">${T('opt_qty')}</label>
          <input data-action="signageQty" type="number" min="1" max="20" value="${signage.qty || 1}" class="optInput optInputNarrow" />
        </div>
      </div>
    </div>` +
    (signage.selected
      ? buildProductRow(signage.selected.id, signage.selected.name || '', signage.selected.image_url, '⚠️', [], sh)
      : '');

  return `
    <div class="uiStepIntro">
      <div class="uiStepIntroIcon">⚙️</div>
      <div>
        <div class="uiStepIntroTitle">${T('opt_title')}</div>
        <div class="uiStepIntroMsg">${T('opt_desc')}</div>
      </div>
    </div>
    <div class="optGrid">
      ${buildOptionCard({
        icon: '🖥️',
        title: T('opt_screen'),
        desc: T('opt_screen_desc'),
        enabled: !!screen.enabled,
        toggleAction: 'screenToggle',
        toggleValue: screen.enabled ? '0' : '1',
        tipHtml: optionTipHtml('screen'),
        body: screenBody,
        T,
        safeHtml: sh,
      })}
      ${buildOptionCard({
        icon: '📦',
        title: T('opt_enclosure'),
        desc: T('opt_enclosure_desc_full') + (screen.enabled ? ' ' + T('opt_enclosure_and_screen') : ''),
        enabled: !!enclosure.enabled,
        toggleAction: 'enclosureToggle',
        toggleValue: enclosure.enabled ? '0' : '1',
        tipHtml: optionTipHtml('enclosure'),
        body: encBody,
        T,
        safeHtml: sh,
      })}
      ${buildOptionCard({
        icon: '⚠️',
        title: T('opt_sign'),
        desc: T('opt_sign_desc'),
        enabled: !!signage.enabled,
        toggleAction: 'signageToggle',
        toggleValue: signage.enabled ? '0' : '1',
        tipHtml: optionTipHtml('signage'),
        body: signBody,
        T,
        safeHtml: sh,
      })}
    </div>
  `;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  window._renderStepComplementsPure = renderStepComplements;
}
