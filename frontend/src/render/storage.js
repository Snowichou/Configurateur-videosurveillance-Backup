// ============================================================
// render/storage.js — Étape Stockage du wizard
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). Aucun accès à un
// global : tout passe via `deps`. Retourne une string HTML.
//
// L'objet `proj` (résultat du moteur de calcul) est calculé en amont
// par le caller (typiquement via `getProjectCached()` dans app.js) et
// passé en paramètre. Si `proj` est null, on retourne un état vide.
//
// Les helpers HTML (storageTipHtml, renderStorageBarSvg) sont aussi
// injectés en tant que fonctions stubbables pour les tests.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

/** Identité — fallback si T() absent. */
const identityT = (k) => String(k ?? '');

/**
 * Rendu de l'étape Stockage.
 *
 * @param {Object}   deps
 * @param {Object}   deps.model                    - MODEL (lit .recording)
 * @param {Object|null} deps.proj                  - Résultat moteur (totalInMbps, requiredTB, totalCameras…)
 * @param {Function} [deps.T=identity]             - i18n
 * @param {Function} [deps.safeHtml=utils.safeHtml]
 * @param {number[]} [deps.fpsOptions=[10,15,25]]  - Liste des FPS proposés
 * @param {Function} [deps.storageTipHtml]         - (rec, proj) → html astuce
 * @param {Function} [deps.renderStorageBarSvg]    - (proj, rec) → svg
 * @returns {string} HTML
 */
export function renderStepStorage(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;

  // État d'erreur : pas de projet calculable (aucune caméra)
  if (!deps.proj) {
    return `<div class="uiEmptyState"><div class="uiEmptyIcon">⚠️</div><div class="uiEmptyTitle">${T('err_compute')}</div><div class="uiEmptyMsg">${T('err_no_camera')}</div></div>`;
  }

  const proj = deps.proj;
  const model = deps.model || {};
  const rec = model.recording || {};
  const fpsOptions = Array.isArray(deps.fpsOptions) && deps.fpsOptions.length
    ? deps.fpsOptions
    : [10, 12, 15, 20, 25];
  const storageTipHtml =
    typeof deps.storageTipHtml === 'function' ? deps.storageTipHtml : () => '';
  const renderStorageBarSvg =
    typeof deps.renderStorageBarSvg === 'function' ? deps.renderStorageBarSvg : () => '';

  const dualStreamOn = rec.dualStream !== false;
  const codecH265 = rec.codec === 'h265';
  const codecH264 = rec.codec === 'h264';
  const modeMotion = rec.mode === 'motion';

  const fpsOptionsHtml = fpsOptions
    .map(
      (v) =>
        `<option value="${v}" ${rec.fps === v ? 'selected' : ''}>${v} FPS${v === 15 ? ' ★' : ''}</option>`
    )
    .join('');

  // Stockage requis (raw si dispo pour debug, sinon valeur finale)
  const requiredTB = proj.rawRequiredTB || proj.requiredTB || 0;
  const totalInMbps = proj.totalInMbps || 0;
  const totalCameras = proj.totalCameras || 0;

  return `
    <div class="uiStepIntro">
      <div class="uiStepIntroIcon">💾</div>
      <div>
        <div class="uiStepIntroTitle">${T('stor_title')}</div>
        <div class="uiStepIntroMsg">${T('stor_desc')}</div>
      </div>
    </div>

    ${storageTipHtml(rec, proj)}

    <!-- Section 1 : Paramètres d'enregistrement -->
    <div class="storageCard">
      <div class="storageCardHeader">
        <div class="storageCardIcon">⚙️</div>
        <div class="storageCardHeaderText">
          <div class="storageCardTitle">${sh(T('stor_settings_title'))}</div>
          <div class="storageCardSubtitle">${sh(T('stor_settings_desc'))}</div>
        </div>
      </div>

      <!-- Ligne 1 : Jours + Heures/jour -->
      <div class="kv">
        <div>
          <strong>
            📅 ${T('stor_days')} <span class="fieldRequired">*</span>
            <span class="infoTip" data-tip="${sh(T('stor_days_tip'))}">i</span>
          </strong>
          <input data-action="recDays" type="number" min="1" max="365"
            value="${sh(rec.daysRetention)}"
            class="storageInput" />
          <div class="storageHint">⚖️ ${T('stor_hint_max_legal')}</div>
        </div>
        <div>
          <strong>
            ⏰ ${T('stor_hours')}
            <span class="infoTip" data-tip="${sh(T('stor_hours_tip'))}">i</span>
          </strong>
          <input data-action="recHours" type="number" min="1" max="24"
            value="${sh(rec.hoursPerDay)}"
            class="storageInput" />
          <div class="storageHint">${T('stor_hint_24h')}</div>
        </div>
      </div>

      <!-- Ligne 2 : FPS + Mode -->
      <div class="kv" style="margin-top:12px">
        <div>
          <strong>
            🎞️ ${T('stor_fps')}
            <span class="infoTip" data-tip="${sh(T('stor_fps_tip'))}">i</span>
          </strong>
          <select data-action="recFps" class="storageInput">
            ${fpsOptionsHtml}
          </select>
          <div class="storageHint">${T('stor_hint_fps')}</div>
        </div>
        <div>
          <strong>
            ⏺️ ${T('stor_mode_label')}
            <span class="infoTip" data-tip="${sh(T('stor_mode_tip_full'))}">i</span>
          </strong>
          <select data-action="recMode" class="storageInput">
            <option value="continuous" ${!modeMotion ? 'selected' : ''}>${T('stor_mode_continuous')}</option>
            <option value="motion" ${modeMotion ? 'selected' : ''}>${T('stor_mode_motion')}</option>
          </select>
          <div class="storageHint">${modeMotion ? T('stor_hint_motion') : T('stor_hint_continuous')}</div>
        </div>
      </div>

      <!-- Ligne 3 : Codec + Marge -->
      <div class="kv" style="margin-top:12px">
        <div>
          <strong>
            🎬 ${T('stor_codec')}
            <span class="infoTip" data-tip="${sh(T('stor_codec_tip'))}">i</span>
          </strong>
          <select data-action="recCodec" class="storageInput">
            <option value="h265" ${codecH265 ? 'selected' : ''}>${T('stor_codec_h265')}</option>
            <option value="h264" ${codecH264 ? 'selected' : ''}>H.264</option>
          </select>
          <div class="storageHint">${codecH264 ? T('stor_hint_h264') : T('stor_hint_h265')}</div>
        </div>
        <div>
          <strong>
            📊 ${T('nvr_margin_label')}
            <span class="infoTip" data-tip="${sh(T('stor_overhead_tip_full'))}">i</span>
          </strong>
          <input data-action="recOver" type="number" min="0" max="50"
            value="${sh(rec.overheadPct)}"
            class="storageInput" />
          <div class="storageHint">${T('stor_hint_margin_breakdown')}</div>
        </div>
      </div>

      <!-- Ligne 4 : Dual stream avec switch -->
      <div class="storageDualRow">
        <div class="storageDualLabel">
          <div class="storageDualIcon">🎞️</div>
          <div>
            <div class="storageDualTitle">
              ${sh(T('stor_dual_stream_label'))}
              <span class="infoTip" data-tip="${sh(T('stor_dual_stream_tip'))}">i</span>
            </div>
            <div class="storageDualSub">
              ${dualStreamOn ? sh(T('stor_dual_stream_hint_on')) : sh(T('stor_dual_stream_hint_off'))}
            </div>
          </div>
        </div>
        <label class="storageSwitch ${dualStreamOn ? 'on' : ''}">
          <input type="checkbox" data-action="recDualStream" ${dualStreamOn ? 'checked' : ''} />
          <span class="storageSwitchTrack"><span class="storageSwitchThumb"></span></span>
          <span class="storageSwitchLabel">${dualStreamOn ? sh(T('opt_state_on')) : sh(T('opt_state_off'))}</span>
        </label>
      </div>
    </div>

    <!-- Section 2 : Résultat du calcul -->
    <div class="storageCard storageCardResult">
      <div class="storageCardHeader">
        <div class="storageCardIcon">📊</div>
        <div class="storageCardHeaderText">
          <div class="storageCardTitle">${sh(T('stor_result'))}</div>
          <div class="storageCardSubtitle">${sh(T('stor_bar_subtitle'))}</div>
        </div>
      </div>

      <div class="storageBarWrap">
        ${renderStorageBarSvg(proj, rec)}
      </div>

      <div class="storageKpiRow">
        <div class="storageKpi storageKpiAccent">
          <div class="storageKpiValue">${requiredTB.toFixed(1)} <span class="storageKpiUnit">To</span></div>
          <div class="storageKpiLabel">${sh(T('stor_required'))}</div>
        </div>
        <div class="storageKpi">
          <div class="storageKpiValue">${totalInMbps.toFixed(1)} <span class="storageKpiUnit">Mbps</span></div>
          <div class="storageKpiLabel">${sh(T('stor_bitrate'))}</div>
        </div>
        <div class="storageKpi">
          <div class="storageKpiValue">${totalCameras}</div>
          <div class="storageKpiLabel">${sh(T('stor_cameras'))}</div>
        </div>
      </div>

      <div class="storageNextStep">
        <span class="storageNextStepIcon">➡️</span>
        <span class="storageNextStepText">${T('stor_next_step')}</span>
      </div>
    </div>
  `;
}

// ─── Compat global (legacy app.js) ──────────────────────────
if (typeof window !== 'undefined') {
  window._renderStepStoragePure = renderStepStorage;
}
