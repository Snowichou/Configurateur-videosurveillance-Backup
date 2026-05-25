// ============================================================
// render/camera-card.js — Carte d'une caméra recommandée
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). HTML pur.
//
// Rend la "pick card" d'une caméra dans l'étape Caméras : image,
// score /100, verdict coloré, badges specs, actions (valider /
// fiche technique / comparer) et accordéon détails.
//
// 100% pur : score interprété + i18n + couleurs + helpers passés
// par injection de dépendances.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

const identityT = (k) => String(k ?? '');
const DEFAULT_CLR = {
  green: '#00BC70',
  okBg: 'rgba(0,188,112,.1)',
  danger: '#DC2626',
  dangerBg: 'rgba(220,38,38,.1)',
};

const CAM_TYPE_LABELS = {
  turret: 'Turret',
  dome: 'Dome',
  bullet: 'Bullet',
  ptz: 'PTZ',
  'fish-eye': 'Fisheye',
  lpr: 'LPR',
};

/**
 * Étiquette IA selon la gamme de la caméra (helper interne).
 */
function getAILabel(cam) {
  if (!cam.ai_features && !cam.analytics_level) return null;
  const range = String(cam.brand_range || '').toUpperCase();
  if (range.includes('NEXT')) return 'IA Intrusion';
  if (range.includes('ADVANCE')) return 'IA Avancée';
  return 'IA';
}

/**
 * Rendu de la carte d'une caméra recommandée.
 *
 * @param {Object}   blk   - bloc caméra (pour l'état validé)
 * @param {Object}   cam   - fiche caméra du catalogue
 * @param {Object}   [deps]
 * @param {Function} deps.interpretScoreForBlock - (blk,cam) => { score, level, message }
 * @param {Function} [deps.T=identity]
 * @param {Object}   [deps.CLR]                  - palette de couleurs
 * @param {Function} [deps.safeHtml]
 * @param {Function} [deps.localizedDatasheetUrl=identity]
 * @param {Array}    [deps.compare=[]]           - ids caméras en comparaison
 * @returns {string} HTML
 */
export function renderCameraPickCard(blk, cam, deps = {}) {
  if (!cam) return '';

  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;
  const CLR = deps.CLR || DEFAULT_CLR;
  const localizedDatasheetUrl =
    typeof deps.localizedDatasheetUrl === 'function' ? deps.localizedDatasheetUrl : (u) => u;
  const interpretScoreForBlock =
    typeof deps.interpretScoreForBlock === 'function' ? deps.interpretScoreForBlock : () => ({});
  const compare = Array.isArray(deps.compare) ? deps.compare : [];

  const isValidated = blk.validated && blk.selectedCameraId === cam.id;
  const interp = interpretScoreForBlock(blk, cam);

  // Config niveau — avec nuances selon le score
  const score = interp.score ?? 0;
  const levelConfig = {
    ok: {
      icon: '✅',
      label:
        score >= 90
          ? T('cam_optimal')
          : score >= 80
            ? T('cam_recommended')
            : T('cam_good_option'),
      color: CLR.green,
      bg: CLR.okBg,
    },
    warn: {
      icon: '⚠️',
      label: score >= 60 ? 'Utilisable' : 'Limite',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,.1)',
    },
    bad: { icon: '❌', label: T('cam_not_adapted'), color: CLR.danger, bg: CLR.dangerBg },
  };
  const lvl = levelConfig[interp.level] || levelConfig.warn;

  // Specs principales
  const mp = cam.resolution_mp || cam.megapixels || '—';
  const ir = cam.ir_range_m || '—';
  const ip = cam.ip ? `IP${cam.ip}` : '';
  const ik = cam.ik ? `IK${cam.ik}` : '';
  const aiLabel = getAILabel(cam);

  // Message explicatif personnalisé (basé sur le scoring)
  const shortMessage =
    interp.message ||
    (interp.level === 'ok'
      ? 'Répond parfaitement à vos critères'
      : interp.level === 'warn'
        ? 'Convient avec quelques limites'
        : 'Ne correspond pas aux critères');

  return `
    <div class="cameraPickCard lvl-${sh(interp.level)}" style="border-left:4px solid ${lvl.color}">
      <div class="cameraPickTop">
        ${
          cam.image_url
            ? `<img class="cameraPickImg" src="${cam.image_url}" alt="${sh(cam.name)}" loading="lazy">`
            : `<div class="cameraPickImg" style="display:flex;align-items:center;justify-content:center;background:var(--panel2);color:var(--muted);font-size:24px">📷</div>`
        }

        <div class="cameraPickMeta">
          <!-- Header avec nom et score -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div style="min-width:0;flex:1">
              <div class="cameraPickTitle" style="font-size:14px;font-weight:900;color:var(--cosmos)">${sh(cam.id)}</div>
              <div class="cameraPickName" style="font-size:12px;color:var(--muted);margin-top:2px">${sh(cam.name || '')}</div>
            </div>
            <div style="min-width:55px;padding:8px 10px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);text-align:center">
              <div style="font-size:16px;font-weight:900;color:var(--cosmos)">${interp.score ?? '—'}</div>
              <div style="font-size:10px;color:var(--muted)">/100</div>
            </div>
          </div>

          <!-- Verdict clair -->
          <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:${lvl.bg};border:1px solid ${lvl.color}30">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:16px">${lvl.icon}</span>
              <span style="font-weight:900;color:${lvl.color}">${lvl.label}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">${shortMessage}</div>
          </div>

          <!-- Specs clés en badges -->
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
            <span class="badgePill" style="background:rgba(59,130,246,.08);border-color:rgba(59,130,246,.25);color:#1d4ed8;font-weight:900">${CAM_TYPE_LABELS[String(cam.type || '').toLowerCase()] || cam.type || '—'}</span>
            <span class="badgePill" style="font-weight:900">${mp} MP</span>
            <span class="badgePill">IR ${ir}m</span>
            ${ip ? `<span class="badgePill">${ip}</span>` : ''}
            ${ik ? `<span class="badgePill">${ik}</span>` : ''}
            ${aiLabel ? `<span class="badgePill" style="background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.3);color:#4338ca">🤖 ${aiLabel}</span>` : ''}            ${isValidated ? `<span class="badgePill" style="background:rgba(0,188,112,.15);border-color:rgba(0,188,112,.4);color:#065f46">${T('cam_selected')}</span>` : ''}
          </div>

          <!-- Actions -->
          <div class="cameraPickActions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button
              data-action="validateCamera"
              data-camid="${sh(cam.id)}"
              class="btnPrimary"
              style="flex:1;min-width:140px"
            >
              ${isValidated ? T('cam_camera_selected') : T('cam_choose_camera')}
            </button>

            ${
              cam.datasheet_url
                ? `
              <a class="btnGhost btnDatasheet" href="${localizedDatasheetUrl(cam.datasheet_url)}" target="_blank" rel="noreferrer" style="text-decoration:none">
                ${T('btn_datasheet')}
              </a>
            `
                : ''
            }
            <button
              class="btnCompare${compare.includes(cam.id) ? ' active' : ''}"
              data-action="uiToggleCompare"
              data-camid="${sh(cam.id)}"
              title="Comparer cette caméra"
            >${compare.includes(cam.id) ? '✓ Comparé' : '⇄ Comparer'}</button>
          </div>

          <!-- Détails (accordéon) -->
          <details style="margin-top:10px">
            <summary style="cursor:pointer;font-size:12px;font-weight:900;color:var(--muted);padding:6px 0">
              + ${T('cam_see_details')}
            </summary>
            <div style="padding:10px;margin-top:6px;background:var(--panel2);border-radius:10px;font-size:12px">
              ${interp.message ? `<div style="margin-bottom:8px">${sh(interp.message)}</div>` : ''}
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;color:var(--muted)">
                <div>• ${T('cam_range')}: ${sh(cam.brand_range || '—')}</div>
                <div>• ${T('cam_focal')}: ${cam.focal_min_mm || '—'}${cam.focal_max_mm ? `-${cam.focal_max_mm}` : ''}mm</div>
                <div>• ${T('cam_low_light')}: ${cam.low_light ? T('cam_yes') : T('cam_no')}</div>
                <div>• ${T('cam_poe')}: ${cam.poe_w || '—'}W</div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
