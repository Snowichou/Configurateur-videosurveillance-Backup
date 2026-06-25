// ============================================================
// render/cameras.js — Étape Caméras (blocs + propositions)
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor). HTML pur.
//
// C'est la plus grosse étape de rendu : colonne gauche = blocs
// caméra éditables, colonne droite = propositions / comparateur.
//
// Le caller (wrapper app.js) gère AVANT l'appel la mutation d'état
// (création d'un bloc par défaut, choix du bloc actif) ; ce module
// ne mute jamais — il reçoit `cameraBlocks` + `activeBlockId` figés
// et toutes les fonctions métier par injection de dépendances.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

const identityT = (k) => String(k ?? '');

// ─── Helpers comparateur (purs) ─────────────────────────────
function cmpNum(a, b, higherIsBetter = true) {
  if (a == null || b == null || a === b || a === 0 || b === 0) return ['', ''];
  const better = higherIsBetter ? a > b : a < b;
  return better ? ['cmpWin', 'cmpLose'] : ['cmpLose', 'cmpWin'];
}
function cmpVal(v, unit = '') {
  if (v == null || v === 0 || v === '') return '—';
  return `${v}${unit}`;
}
function cmpBool(v) {
  return v ? '<span class="cmpCheck">✓</span>' : '<span class="cmpCross">✗</span>';
}
function focalRange(cam) {
  if (!cam.focal_min_mm) return '—';
  return cam.focal_max_mm && cam.focal_max_mm !== cam.focal_min_mm
    ? `${cam.focal_min_mm}–${cam.focal_max_mm} mm`
    : `${cam.focal_min_mm} mm`;
}
function emplacementLabel(cam) {
  const arr = [];
  if (cam.emplacement_interieur) arr.push('Int.');
  if (cam.emplacement_exterieur) arr.push('Ext.');
  return arr.join(' / ') || '—';
}
function analyticsLabel(v) {
  const m = {
    'Intrusion humaine': 'Intrusion',
    Intrusion: 'Intrusion',
    'IA Avancée': 'IA Avancée',
    'IA Avancee': 'IA Avancée',
    'IA Intrusion': 'IA Intrusion',
  };
  return m[v] || v || '—';
}

/**
 * Carte d'un bloc caméra (colonne gauche) — helper interne.
 */
function buildBlockCard(blk, idx, ctx) {
  const { T, sh, normalizeEmplacement, objectiveLabel, canRecommendBlock, activeBlockId } = ctx;
  const ans = blk.answers || {};
  const isActive = blk.id === activeBlockId;

  return `
        <div class="recoCard cameraBlockCard" data-action="setActiveBlock" data-bid="${sh(blk.id)}"
             style="padding:12px;cursor:pointer;${isActive ? 'outline:1px solid rgba(0,150,255,.35)' : ''}">
          <div class="recoHeader">
            <div>
              <div class="recoName">
                ${T('cam_block')} ${idx + 1}
                ${blk.label ? `• ${sh(blk.label)}` : ''}
                • ${blk.validated ? T('cam_validated_label') : T('cam_in_progress')}
                ${isActive ? `<span style="margin-left:8px" class="badgePill">${T('cam_active')}</span>` : ''}
              </div>
              <div class="muted">${T('cam_fill_hint')}</div>
            </div>
            <div class="score">${blk.qty || 1}x</div>
          </div>

                    <div style="margin-top:10px">
            <strong>${T('cam_block_name')}</strong>
            <input
              data-action="inputBlockLabel"
              data-bid="${sh(blk.id)}"
              type="text"
              maxlength="60"
              value="${sh(blk.label ?? '')}"
              placeholder="ex: Parking entrée, Couloir RDC…"
              style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)"
            />
          </div>

          <div class="kv" style="margin-top:12px">
            <div>
              <strong>
                📍 ${T('cam_placement')} <span class="fieldRequired">*</span>
                <span class="infoTip" data-tip="Intérieur ou extérieur ? Cela détermine la protection IP nécessaire et les caméras compatibles.">i</span>
              </strong>
              <select data-action="changeBlockField" data-bid="${sh(blk.id)}" data-field="emplacement"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${ans.emplacement ? 'var(--line)' : 'rgba(220,38,38,.4)'};background:var(--panel2);color:var(--text)">
                <option value="">— Choisir l'emplacement —</option>
                <option value="interieur" ${normalizeEmplacement(ans.emplacement) === 'interieur' ? 'selected' : ''}>${'🏠 ' + T('cam_interior')}</option>
                <option value="exterieur" ${normalizeEmplacement(ans.emplacement) === 'exterieur' ? 'selected' : ''}>${'🌧️ ' + T('cam_exterior')}</option>
              </select>
            </div>

            <div>
              <strong>
                🎯 ${T('cam_objective')} <span class="fieldRequired">*</span>
                <span class="infoTip" data-tip="Norme EN 62676-4 : Détection = présence humaine | Observation = détails d'une scène | Reconnaissance = distinguer une personne | Identification = reconnaître un visage.">i</span>
              </strong>
              <select data-action="changeBlockField" data-bid="${sh(blk.id)}" data-field="objective"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${ans.objective ? 'var(--line)' : 'rgba(220,38,38,.4)'};background:var(--panel2);color:var(--text)">
                <option value="">${T('cam_choose_objective')}</option>
                <option value="detection" ${ans.objective === 'detection' ? 'selected' : ''}>${'👤 ' + T('cam_detection_long')}</option>
                <option value="observation" ${ans.objective === 'observation' || ans.objective === 'dissuasion' ? 'selected' : ''}>${'👁️ ' + T('cam_observation_long')}</option>
                <option value="reconnaissance" ${ans.objective === 'reconnaissance' ? 'selected' : ''}>${'🔍 ' + T('cam_recognition_long')}</option>
                <option value="identification" ${ans.objective === 'identification' ? 'selected' : ''}>${'🪪 ' + T('cam_identification_long')}</option>
              </select>
            </div>

            <div>
              <strong>
                📏 ${T('cam_distance')} <span class="fieldRequired">*</span>
                <span class="infoTip" data-tip="${T('cam_tip_distance')}">i</span>
              </strong>
              <input data-action="inputBlockField" data-bid="${sh(blk.id)}" data-field="distance_m" type="number" min="1" max="999"
                value="${sh(ans.distance_m ?? '')}" placeholder="Ex: 15"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${ans.distance_m ? 'var(--line)' : 'rgba(220,38,38,.4)'};background:var(--panel2);color:var(--text)" />
              <div class="muted" style="margin-top:6px">
                ${T('cam_dori_norm')} : ${sh(ans.objective ? objectiveLabel(ans.objective) : '—')}
              </div>
            </div>

            <div>
              <strong>
                🔧 Hauteur de montage (m)
                <span class="infoTip" data-tip="Hauteur de fixation de la caméra. Sert au calcul de distance par photo : distance = hauteur / tan(angle de plongée).">i</span>
              </strong>
              <input data-action="inputBlockField" data-bid="${sh(blk.id)}" data-field="height_m" type="number" min="0.1" max="50" step="0.1" inputmode="decimal"
                value="${sh(ans.height_m ?? '')}" placeholder="Ex: 2.5"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)" />
              <button data-action="measureDistance" data-bid="${sh(blk.id)}" type="button" class="btnGhost"
                style="width:100%;margin-top:8px">📷 Mesurer la distance (photo + gyroscope)</button>
              ${ans.hasPhoto ? `
              <div style="display:flex;gap:6px;margin-top:6px">
                <button data-action="viewPhoto" data-bid="${sh(blk.id)}" type="button" class="btnGhost" style="flex:1">🖼️ Voir la photo</button>
                <button data-action="removePhoto" data-bid="${sh(blk.id)}" type="button" class="btnGhost" aria-label="Supprimer la photo">🗑️</button>
              </div>` : ``}
            </div>

            <div>
              <strong>
                🔧 ${T('cam_mount_type')}
                <span class="infoTip" data-tip="${T('cam_tip_mounting')}">i</span>
              </strong>
              <select data-action="changeBlockField" data-bid="${sh(blk.id)}" data-field="mounting"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">
                <option value="wall" ${ans.mounting === 'wall' ? 'selected' : ''}>${'🧱 ' + T('cam_wall_option')}</option>
                <option value="ceiling" ${ans.mounting === 'ceiling' ? 'selected' : ''}>${'⬆️ ' + T('cam_ceiling_option')}</option>
              </select>
            </div>

            <div>
              <strong>
                🔢 ${T('cam_quantity')}
                <span class="infoTip" data-tip="${T('cam_tip_quantity')}">i</span>
              </strong>
              <input data-action="inputBlockQty" data-bid="${sh(blk.id)}" type="number" min="1" max="999"
                value="${sh(blk.qty ?? 1)}"
                title="Combien de caméras identiques souhaitez-vous pour cette configuration ?"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)" />
            </div>

            <div>
              <strong title="${T('cam_quality_title_full')}">
                ⭐ ${T('cam_quality')}
              </strong>
              <select data-action="changeBlockQuality" data-bid="${sh(blk.id)}"
                title="${T('cam_quality_title')}"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">
                <option value="low" ${blk.quality === 'low' ? 'selected' : ''}>${'💰 ' + T('cam_quality_economic')}</option>
                <option value="standard" ${!blk.quality || blk.quality === 'standard' ? 'selected' : ''}>${'⭐ ' + T('cam_quality_standard')}</option>
                <option value="high" ${blk.quality === 'high' ? 'selected' : ''}>💎 ${T('cam_hd')}</option>
              </select>
            </div>
          </div>
          <div class="reasons" style="margin-top:12px">
            ${canRecommendBlock(blk) ? `✅ ${T('cam_criteria_ok')}` : `⚠️ ${T('err_fill_required_fields')}`}
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">
            ${blk.validated ? `<button data-action="unvalidateBlock" data-bid="${sh(blk.id)}" class="btnGhost" type="button">${T('cam_cancel_validation')}</button>` : ``}
            <button data-action="removeBlock" data-bid="${sh(blk.id)}" class="btnGhost" type="button">${T('cam_remove_block')}</button>
          </div>
        </div>
      `;
}

/**
 * Panneau de comparaison 2 caméras (helper interne).
 */
function buildCompareHtml(cmpA, cmpB, ctx) {
  const { sh, getMpFromCam, getIrFromCam } = ctx;
  const mpA = getMpFromCam(cmpA),
    mpB = getMpFromCam(cmpB);
  const irA = getIrFromCam(cmpA),
    irB = getIrFromCam(cmpB);
  const [mpCA, mpCB] = cmpNum(mpA, mpB);
  const [irCA, irCB] = cmpNum(irA, irB);
  const [dorDetCA, dorDetCB] = cmpNum(cmpA.dori_detection_m, cmpB.dori_detection_m);
  const [dorObCA, dorObCB] = cmpNum(cmpA.dori_observation_m, cmpB.dori_observation_m);
  const [dorReCA, dorReCB] = cmpNum(cmpA.dori_recognition_m, cmpB.dori_recognition_m);
  const [dorIdCA, dorIdCB] = cmpNum(cmpA.dori_identification_m, cmpB.dori_identification_m);
  const [brCA, brCB] = cmpNum(cmpA.bitrate_mbps_typical, cmpB.bitrate_mbps_typical, false);
  const [poeCA, poeCB] = cmpNum(cmpA.poe_w, cmpB.poe_w, false);
  const [ipCA, ipCB] = cmpNum(cmpA.ip, cmpB.ip);
  const [ikCA, ikCB] = cmpNum(cmpA.ik, cmpB.ik);
  const [wledCA, wledCB] = cmpNum(cmpA.white_led_range_m, cmpB.white_led_range_m);
  const [strCA, strCB] = cmpNum(cmpA.streams_max, cmpB.streams_max);

  const row = (label, vA, vB, clA = '', clB = '') => `
      <div class="cmpRow">
        <div class="cmpRowLabel">${label}</div>
        <div class="cmpRowVal ${clA}">${vA}</div>
        <div class="cmpRowVal ${clB}">${vB}</div>
      </div>`;

  const sectionHead = (label) => `
      <div class="cmpSectionHead"><span>${label}</span></div>`;

  return `
    <div class="cmpCard">
      <div class="cmpCardHead">
        <div class="cmpCardTitle">⇄ Comparaison</div>
        <button class="cmpCardClose" data-action="uiClearCompare" type="button">✕ Effacer</button>
        </div>

      <div class="cmpCols">
        <div class="cmpColSpacer"></div>
        <div class="cmpColHeader">
          ${cmpA.image_url ? `<img class="cmpColImg" src="${cmpA.image_url}" alt="" loading="lazy">` : `<div class="cmpColImgPh">📷</div>`}
          <div class="cmpColId">${sh(cmpA.id)}</div>
          <div class="cmpColName">${sh(cmpA.name || '')}</div>
          <span class="cmpColRange">${sh(cmpA.brand_range || '')}</span>
      </div>
        <div class="cmpColHeader">
          ${cmpB.image_url ? `<img class="cmpColImg" src="${cmpB.image_url}" alt="" loading="lazy">` : `<div class="cmpColImgPh">📷</div>`}
          <div class="cmpColId">${sh(cmpB.id)}</div>
          <div class="cmpColName">${sh(cmpB.name || '')}</div>
          <span class="cmpColRange">${sh(cmpB.brand_range || '')}</span>
        </div>
        </div>

      <div class="cmpTable">
        ${sectionHead('🔭 Optique')}
        ${row('Résolution', cmpVal(mpA, ' MP'), cmpVal(mpB, ' MP'), mpCA, mpCB)}
        ${row('Focale', focalRange(cmpA), focalRange(cmpB))}
        ${row('Type', sh(cmpA.type || '—'), sh(cmpB.type || '—'))}
        ${row('Emplacement', emplacementLabel(cmpA), emplacementLabel(cmpB))}

        ${sectionHead('📐 Portée DORI')}
        ${row('Détection', cmpVal(cmpA.dori_detection_m, ' m'), cmpVal(cmpB.dori_detection_m, ' m'), dorDetCA, dorDetCB)}
        ${row('Observation', cmpVal(cmpA.dori_observation_m, ' m'), cmpVal(cmpB.dori_observation_m, ' m'), dorObCA, dorObCB)}
        ${row('Reconnaissance', cmpVal(cmpA.dori_recognition_m, ' m'), cmpVal(cmpB.dori_recognition_m, ' m'), dorReCA, dorReCB)}
        ${row('Identification', cmpVal(cmpA.dori_identification_m, ' m'), cmpVal(cmpB.dori_identification_m, ' m'), dorIdCA, dorIdCB)}

        ${sectionHead('🌙 Vision nocturne')}
        ${row('Portée IR', cmpVal(irA, ' m'), cmpVal(irB, ' m'), irCA, irCB)}
        ${row('LED blanc', cmpVal(cmpA.white_led_range_m, ' m'), cmpVal(cmpB.white_led_range_m, ' m'), wledCA, wledCB)}
        ${row('Basse lumière', cmpA.low_light_raw || '—', cmpB.low_light_raw || '—')}

        ${sectionHead('🛡️ Protection')}
        ${row('Indice IP', cmpA.ip ? `IP${cmpA.ip}` : '—', cmpB.ip ? `IP${cmpB.ip}` : '—', ipCA, ipCB)}
        ${row('Indice IK', cmpA.ik ? `IK${cmpA.ik}` : '—', cmpB.ik ? `IK${cmpB.ik}` : '—', ikCA, ikCB)}
        ${row('Microphone', cmpBool(cmpA.microphone), cmpBool(cmpB.microphone))}

        ${sectionHead('⚡ Réseau')}
        ${row('Débit typique', cmpVal(cmpA.bitrate_mbps_typical, ' Mbps'), cmpVal(cmpB.bitrate_mbps_typical, ' Mbps'), brCA, brCB)}
        ${row('Conso. PoE', cmpVal(cmpA.poe_w, ' W'), cmpVal(cmpB.poe_w, ' W'), poeCA, poeCB)}
        ${row('Flux max', cmpVal(cmpA.streams_max, ''), cmpVal(cmpB.streams_max, ''), strCA, strCB)}

        ${sectionHead('🧠 Intelligence')}
        ${row('Analytics', analyticsLabel(cmpA.analytics_level), analyticsLabel(cmpB.analytics_level))}
      </div>

      <div class="cmpLegend">
        <span class="cmpLegItem"><span class="cmpLegDot cmpLegWin"></span>Meilleur</span>
        <span class="cmpLegItem"><span class="cmpLegDot cmpLegLose"></span>Inférieur</span>
    </div>
    </div>`;
}

/**
 * Rendu de l'étape Caméras.
 *
 * @param {Object}   deps
 * @param {Array}    deps.cameraBlocks            - Blocs caméra (figés, non mutés)
 * @param {string}   deps.activeBlockId           - id du bloc actif
 * @param {Object}   [deps.ui]                    - { favorites, mode, onlyFavs, compare }
 * @param {Function} [deps.T=identity]
 * @param {Function} [deps.safeHtml]
 * @param {Function} deps.normalizeEmplacement
 * @param {Function} deps.objectiveLabel
 * @param {Function} deps.canRecommendBlock
 * @param {Function} deps.buildRecoForBlock
 * @param {Function} deps.interpretScoreForBlock
 * @param {Function} deps.getCameraById
 * @param {Function} deps.getMpFromCam
 * @param {Function} deps.getIrFromCam
 * @param {Function} deps.camPickCardHTML
 * @returns {string} HTML
 */
export function renderStepCameras(deps = {}) {
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;
  const cameraBlocks = Array.isArray(deps.cameraBlocks) ? deps.cameraBlocks : [];
  const activeBlockId = deps.activeBlockId;
  const ui = deps.ui || {};
  const normalizeEmplacement =
    typeof deps.normalizeEmplacement === 'function' ? deps.normalizeEmplacement : (x) => x;
  const objectiveLabel = typeof deps.objectiveLabel === 'function' ? deps.objectiveLabel : (x) => x;
  const canRecommendBlock =
    typeof deps.canRecommendBlock === 'function' ? deps.canRecommendBlock : () => false;
  const buildRecoForBlock =
    typeof deps.buildRecoForBlock === 'function' ? deps.buildRecoForBlock : () => null;
  const interpretScoreForBlock =
    typeof deps.interpretScoreForBlock === 'function' ? deps.interpretScoreForBlock : () => ({});
  const getCameraById = typeof deps.getCameraById === 'function' ? deps.getCameraById : () => null;
  const getMpFromCam = typeof deps.getMpFromCam === 'function' ? deps.getMpFromCam : () => 0;
  const getIrFromCam = typeof deps.getIrFromCam === 'function' ? deps.getIrFromCam : () => 0;
  const camPickCardHTML =
    typeof deps.camPickCardHTML === 'function' ? deps.camPickCardHTML : () => '';

  const activeBlock =
    cameraBlocks.find((b) => b.id === activeBlockId) || cameraBlocks[0] || { answers: {} };

  const blockCtx = { T, sh, normalizeEmplacement, objectiveLabel, canRecommendBlock, activeBlockId };
  const leftBlocks = cameraBlocks.map((blk, idx) => buildBlockCard(blk, idx, blockCtx)).join('');

  const reco = buildRecoForBlock(activeBlock);
  const ansA = activeBlock.answers || {};

  let rightHtml = `
      <div class="recoCard" style="padding:12px">
        <div class="proposalsTitle">
          <div>
            <div class="recoName">${T('cam_proposals')}</div>
            <div class="muted">
              ${T('cam_active_block')} :
              <strong>${sh(ansA.use_case || '—')}</strong> •
              ${sh(normalizeEmplacement(ansA.emplacement) || '—')} •
              ${sh(ansA.objective || '—')} •
              ${sh(ansA.distance_m || '—')}m
            </div>
          </div>
          <div class="score">📊</div>
        </div>
      </div>
    `;

  if (!canRecommendBlock(activeBlock)) {
    rightHtml += `<div class="recoCard" style="padding:12px"><div class="muted">⚠️ ${T('cam_fill_required')}</div></div>`;
  } else {
    const primary = reco?.primary?.camera || null;
    const alternatives = (reco?.alternatives || []).map((x) => x.camera).filter(Boolean);

    if (!primary) {
      rightHtml += `
          <div class="recoCard" style="padding:12px">
            <div class="reasons">
              <strong>${T('err_no_camera_compatible')}</strong><br>
              ${(reco?.reasons || []).map((r) => `• ${sh(r)}`).join('<br>')}
            </div>
          </div>
        `;
    } else {
      // ---- Liste candidates (tri + filtre) ----
      const favSet = new Set((ui.favorites || []).map(String));
      const mode = ui.mode === 'expert' ? 'expert' : 'simple';

      const items = [primary, ...alternatives].filter(Boolean).map((cam) => {
        const interp = interpretScoreForBlock(activeBlock, cam);
        const lvlRank = interp.level === 'ok' ? 0 : interp.level === 'warn' ? 1 : 2;
        const ratioRank =
          interp.ratio != null && Number.isFinite(interp.ratio) ? interp.ratio : -999;
        const isFav = favSet.has(String(cam.id));
        return { cam, interp, lvlRank, ratioRank, isFav };
      });

      // Filtre favoris (optionnel)
      const filtered = ui.onlyFavs ? items.filter((x) => x.isFav) : items;

      // Tri: favoris > niveau (ok/warn/bad) > score > ratio
      filtered.sort((a, b) => {
        if (a.isFav !== b.isFav) return a.isFav ? -1 : 1;
        if (a.lvlRank !== b.lvlRank) return a.lvlRank - b.lvlRank;
        if ((b.interp.score || 0) !== (a.interp.score || 0))
          return (b.interp.score || 0) - (a.interp.score || 0);
        return (b.ratioRank || 0) - (a.ratioRank || 0);
      });

      // Simple = Top 3, Expert = tout
      let shown = filtered;
      if (mode === 'simple') {
        shown = filtered.slice(0, 3);
        // garantit que la "primary" reste visible si elle est filtrée par tri (hors mode favoris)
        if (!ui.onlyFavs) {
          const hasPrimary = shown.some((x) => String(x.cam.id) === String(primary.id));
          if (!hasPrimary) {
            shown = [items.find((x) => String(x.cam.id) === String(primary.id))]
              .filter(Boolean)
              .concat(shown.slice(0, 2));
          }
        }
      }

      // Compare panel
      const cmp = Array.isArray(ui.compare) ? ui.compare.map(String) : [];
      const cmpA = cmp[0] ? getCameraById(cmp[0]) : null;
      const cmpB = cmp[1] ? getCameraById(cmp[1]) : null;

      const compareHtml =
        cmpA && cmpB
          ? buildCompareHtml(cmpA, cmpB, { sh, getMpFromCam, getIrFromCam })
          : cmpA || cmpB
            ? `
    <div class="cmpCardWaiting">
      <div class="cmpWaitIcon">⇄</div>
      <div class="cmpWaitText">Sélectionne une 2<sup>e</sup> caméra à comparer</div>
      <button class="cmpCancelBtn" data-action="uiClearCompare" type="button">Annuler</button>
    </div>`
            : '';

      // Toolbar 2.0 — Simple / Détails (Détails = mode "expert" interne)
      const toolbarHtml = '';

      const cardsHtml = shown.length
        ? `
    <div class="cameraCards">
      ${shown
        .map((x) =>
          camPickCardHTML(
            activeBlock,
            x.cam,
            String(x.cam.id) === String(primary.id) ? 'Meilleur choix' : 'Alternative',
          ),
        )
        .join('')}
    </div>
  `
        : `
    <div class="recoCard" style="padding:12px">
      <div class="muted">
        ${ui.onlyFavs ? T('err_no_fav') : T('err_no_camera_display')}
      </div>
    </div>
  `;

      // ✅ Ajout final (ordre voulu)
      rightHtml += toolbarHtml + compareHtml + cardsHtml;
    }
  }

  return `
      <div class="stepSplit">
        <div class="blocksCol">
          ${leftBlocks}

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button data-action="addBlock" class="btnGhost" type="button">+ ${T('cam_add_block')}</button>
          </div>
        </div>

        <div class="proposalsCol">
          ${rightHtml}
        </div>
      </div>
    `;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
