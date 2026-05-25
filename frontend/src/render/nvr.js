// ============================================================
// render/nvr.js — Étape NVR / Réseau (PoE switches)
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). HTML pur.
//
// Le caller passe le projet calculé (`proj`) ainsi que `isManual`
// (présence d'un overrideNvrId dans le MODEL). Tout le reste est
// composé en HTML pur sans accès au MODEL.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

const identityT = (k) => String(k ?? '');

/**
 * Carte d'une alternative NVR (helper interne).
 */
function buildAltCard(alt, nvr, isAdvance, T, sh) {
  const altIsAdvance = (alt.brand_range || '').toUpperCase() === 'ADVANCE';
  const hasMoreCh = alt.channels > nvr.channels;
  const hasMoreBays = alt.hdd_bays > nvr.hdd_bays;
  const why = altIsAdvance && !isAdvance
    ? '🤖 Gamme ADVANCE — analytics IA embarquée'
    : hasMoreCh
      ? T('nvr_capacity_higher').replace('{0}', alt.channels)
      : hasMoreBays
        ? T('nvr_more_storage').replace('{0}', alt.hdd_bays)
        : T('nvr_alt_compatible');
  const badgeAi = altIsAdvance
    ? '<span class="techBadge" style="padding:2px 6px;font-size:10px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#4338ca">🤖 IA</span>'
    : '';
  return `<div class="nvrAltCard" data-action="selectNvr" data-nvrid="${sh(alt.id)}">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px">
        <strong style="font-size:14px">${sh(alt.id)}</strong>${badgeAi}
      </div>
      <div class="uiMuted" style="font-size:12px;margin-top:2px">${alt.channels} ${T('nvr_channels_label')} • ${alt.max_in_mbps} Mbps • ${alt.hdd_bays} ${T('nvr_bays')}</div>
      <div style="font-size:11px;color:#3B82F6;margin-top:4px">${why}</div>
    </div>
    <span style="font-size:20px;color:var(--muted);padding:0 8px">›</span>
  </div>`;
}

/**
 * Section PoE switches (helper interne).
 */
function buildSwitchSection(sw, totalCameras, T, sh) {
  if (!sw || !sw.required) {
    const nvrPoe = sw?.nvrPoePorts || 0;
    return nvrPoe > 0
      ? `<div class="uiSection" style="margin-top:12px"><div class="uiSectionHeader"><div class="uiSectionIcon">🔌</div><div><div class="uiSectionTitle">${T('nvr_poe')}</div><div class="uiSectionMeta">Caméras sur les ${nvrPoe} ports PoE du NVR</div></div></div></div>`
      : '';
  }
  const dist = sw.cameraDistribution || [];
  const cards = dist
    .map((d, i) => {
      const item = d.switch;
      const img = item.image_url
        ? `<img class="uiProductImg" src="${item.image_url}" alt="" loading="lazy">`
        : '<div class="uiProductImgPh">📷</div>';
      const budget = item.poe_budget_w ? ` • ${item.poe_budget_w}W` : '';
      return `<div class="uiProductCard" style="margin-top:${i ? '6' : '0'}px"><div class="uiProductMain"><div class="uiProductInfo"><div class="uiProductTitle">${sh(item.id || item.name || 'Switch')}</div><div class="uiProductMeta">${d.camerasConnected} cam / ${d.totalPorts} ports PoE${budget}</div></div>${img}</div></div>`;
    })
    .join('');
  const camsLabel = sw.camerasOnSwitches || totalCameras;
  return `<div class="uiSection" style="margin-top:12px"><div class="uiSectionHeader"><div class="uiSectionIcon">🔌</div><div><div class="uiSectionTitle">${T('nvr_poe')}</div><div class="uiSectionMeta">${camsLabel} ${T('nvr_poe_cameras')} • ${sw.totalPorts} ${T('nvr_poe_ports')}</div></div></div><div class="uiSectionBody">${cards}</div></div>`;
}

/**
 * Rendu de l'étape NVR / Réseau.
 *
 * @param {Object}   deps
 * @param {Object|null} deps.proj         - Projet calculé (null = état vide)
 * @param {boolean}  [deps.isManual=false] - true si overrideNvrId est présent
 * @param {Function} [deps.T=identity]
 * @param {Function} [deps.safeHtml]
 * @param {Function} [deps.localizedDatasheetUrl=identity]
 * @returns {string} HTML
 */
export function renderStepNvrNetwork(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;
  const localizedDatasheetUrl =
    typeof deps.localizedDatasheetUrl === 'function' ? deps.localizedDatasheetUrl : (u) => u;

  if (!deps.proj) {
    return `<div class="uiEmptyState"><div class="uiEmptyIcon">⚠️</div><div class="uiEmptyTitle">${T('err_compute')}</div><div class="uiEmptyMsg">${T('err_no_camera')}</div></div>`;
  }

  const proj = deps.proj;
  const isManual = !!deps.isManual;
  const nvr = proj.nvrPick?.nvr;
  const isAdvance = nvr && (nvr.brand_range || '').toUpperCase() === 'ADVANCE';

  let nvrHtml;
  if (nvr) {
    const cappedWarn = proj.storageCapped
      ? `<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);font-size:12px;color:#991b1b">⚠️ ${T('nvr_storage_capped').replace('{0}', proj.disks ? proj.disks.maxTotalTB : '—').replace('{1}', nvr.hdd_bays)}</div>`
      : '';
    const channelsBadge = proj.totalCameras <= nvr.channels
      ? `<span class="techBadge techBadgeOk">✅ ${T('nvr_badge_channels')}</span>`
      : `<span class="techBadge techBadgeWarn">⚠️ ${T('nvr_badge_channels')}</span>`;
    const bitrateBadge = proj.totalInMbps <= (nvr.max_in_mbps || 256)
      ? `<span class="techBadge techBadgeOk">✅ ${T('nvr_badge_bitrate')}</span>`
      : `<span class="techBadge techBadgeWarn">⚠️ ${T('nvr_badge_bitrate')}</span>`;
    const storageBadge = !proj.storageCapped
      ? `<span class="techBadge techBadgeOk">✅ ${T('nvr_badge_storage')}</span>`
      : `<span class="techBadge techBadgeWarn">⚠️ ${T('nvr_badge_storage')}</span>`;
    const imgRow = nvr.image_url
      ? `<div style="text-align:center;margin:10px 0"><img style="max-height:100px;border-radius:8px" src="${nvr.image_url}" alt="" loading="lazy"></div>`
      : '';
    const aiBadge = isAdvance
      ? '<span class="techBadge" style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#4338ca;font-weight:900">🤖 IA</span>'
      : '';
    const manualHint = isManual ? ' <em style="color:#3B82F6">(manuel)</em>' : '';
    const resetBtn = isManual
      ? '<button data-action="resetNvr" class="uiLink" style="background:none;border:none;cursor:pointer;color:#DC2626;font-size:12px;font-weight:700">✕ Auto</button>'
      : '';
    const nvrDsLink = nvr.datasheet_url
      ? `<a class="uiLink" href="${localizedDatasheetUrl(nvr.datasheet_url)}" target="_blank" rel="noreferrer">${T('nvr_datasheet_label')}</a>`
      : '';
    const hddDsLink = proj.disks?.hddRef?.datasheet_url
      ? `<a class="uiLink" href="${localizedDatasheetUrl(proj.disks.hddRef.datasheet_url)}" target="_blank" rel="noreferrer">💿 HDD ${sh(proj.disks.hddRef.id || '')}</a>`
      : '';

    const altsList = proj.nvrPick.alternatives || [];
    const altsHtml = altsList.length
      ? `<div class="uiSection" style="margin-top:8px"><div class="uiSectionHeader"><div class="uiSectionIcon">🔄</div><div><div class="uiSectionTitle">${T('nvr_alternatives')}</div></div></div><div class="uiSectionBody" style="padding:0">${altsList.map((a) => buildAltCard(a, nvr, isAdvance, T, sh)).join('')}</div></div>`
      : '';

    nvrHtml = `
    <div class="uiSection">
      <div class="uiSectionHeader">
        <div class="uiSectionIcon">🖥️</div>
        <div>
          <div class="uiSectionTitle">${sh(nvr.id)}</div>
          <div class="uiSectionMeta">${sh(nvr.name)}${manualHint}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${aiBadge}
          <div class="uiBadge uiBadgeGreen">NVR</div>
        </div>
      </div>
      <div class="uiSectionBody">
        <div class="uiKpiRow">
          <div class="uiKpiCard">
            <div class="uiKpiValue">${proj.totalCameras} / ${nvr.channels}</div>
            <div class="uiKpiLabel">${T('nvr_channels')}</div>
          </div>
          <div class="uiKpiCard">
            <div class="uiKpiValue">${proj.totalInMbps.toFixed(0)} / ${nvr.max_in_mbps || '—'}</div>
            <div class="uiKpiLabel">${T('stor_bitrate')}</div>
          </div>
          <div class="uiKpiCard">
            <div class="uiKpiValue">${proj.disks ? proj.disks.count + ' × ' + proj.disks.sizeTB + ' To' : '—'}</div>
            <div class="uiKpiLabel">${T('nvr_disks').replace('{0}', nvr.hdd_bays)}</div>
          </div>
          <div class="uiKpiCard">
            <div class="uiKpiValue">${(proj.rawRequiredTB || proj.requiredTB).toFixed(1)} To</div>
            <div class="uiKpiLabel">${proj.storageCapped ? T('nvr_storage_limited') + ' ⚠️' : T('pdf_storage')}</div>
          </div>
        </div>
        ${cappedWarn}
        <div class="techValidation" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${channelsBadge}
          ${bitrateBadge}
          ${storageBadge}
        </div>
        ${imgRow}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          ${nvrDsLink}
          ${hddDsLink}
          ${resetBtn}
        </div>
      </div>
    </div>
    ${altsHtml}
  `;
  } else {
    nvrHtml = `
    <div class="uiSection uiSectionWarn">
      <div class="uiSectionHeader">
        <div class="uiSectionIcon">🖥️</div>
        <div>
          <div class="uiSectionTitle">${T('nvr_title')}</div>
          <div class="uiSectionMeta">${T('nvr_none')}</div>
        </div>
        <div class="uiBadge">NVR</div>
      </div>
      <div class="uiSectionBody">
        <div class="uiMuted">Ajoute des NVR dans <code>nvrs.csv</code> (channels, max_in_mbps).</div>
      </div>
    </div>
  `;
  }

  const swHtml = buildSwitchSection(proj.switches, proj.totalCameras, T, sh);
  return `${nvrHtml}${swHtml}`;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
