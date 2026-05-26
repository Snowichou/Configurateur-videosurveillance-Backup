/* ════════════════════════════════════════════════════════════════════════
 * CHIPS ENHANCER v3 — Configurateur Comelit
 *
 * Transforme les <select> de l'étape Caméras en groupes de chips visuels.
 * Layout vertical compact : icon au-dessus du label.
 * Auto-suffisant : injecte ses propres styles.
 *
 * Champs ciblés :
 *   - data-field="emplacement"  → 2 chips Intérieur / Extérieur
 *   - data-field="objective"    → 4 chips DORI sur 2 lignes (2 cols)
 *   - data-field="mounting"     → 2 chips Mur / Plafond
 *   - data-action="changeBlockQuality" → 3 chips Économique / Standard / HD
 *
 * À inclure DANS LE HTML après app.js :
 *   <script src="chips-enhancer.js" defer></script>
 * ════════════════════════════════════════════════════════════════════════ */

import { T as _T } from './i18n.js';

(function () {
  'use strict';

  // ─── SVG icons (24×24 viewBox) ───────────────────────────────────────
  const ICONS = {
    home: '<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    cloud: '<path d="M17 18a4 4 0 0 0 .9-7.9 5 5 0 0 0-9.6-1A4 4 0 0 0 7 18h10z"/><path d="M8 19v3M12 20v3M16 19v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    idCard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 13h4M14 16H6"/>',
    wall: '<rect x="3" y="4" width="6" height="6" rx="0.5"/><rect x="11" y="4" width="6" height="6" rx="0.5"/><rect x="3" y="12" width="6" height="6" rx="0.5"/><rect x="11" y="12" width="6" height="6" rx="0.5"/>',
    ceiling: '<path d="M3 6h18"/><path d="M5 6v3M9 6v3M13 6v3M17 6v3M21 6v3"/><circle cx="12" cy="14" r="2.6"/><path d="M12 16.6V21"/>',
    pole: '<line x1="12" y1="3" x2="12" y2="21"/><circle cx="12" cy="9" r="2.6"/><line x1="12" y1="11.6" x2="12" y2="14"/><line x1="9" y1="3" x2="15" y2="3"/><line x1="9" y1="21" x2="15" y2="21"/>',
    corner: '<polyline points="3 21 3 3 21 3"/><circle cx="8" cy="8" r="2.4"/><line x1="9.7" y1="9.7" x2="13" y2="13"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9.5h4a2 2 0 0 1 0 4h-4M9 9.5v8M9 13.5h4a2 2 0 0 1 0 4h-4"/>',
    star: '<polygon points="12,3 15,9.5 22,10.5 17,15.5 18.5,22 12,18.5 5.5,22 7,15.5 2,10.5 9,9.5"/>',
    diamond: '<path d="M6 4h12l4 6-10 11L2 10z"/><path d="M2 10h20"/>',
    // Type spécial caméra
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    ptz: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    panoramic: '<path d="M3 9c5-3 13-3 18 0v6c-5 3-13 3-18 0z"/><circle cx="12" cy="12" r="2"/>',
    // Type d'IA
    aiNext: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 12h6M12 9v6"/>',
    aiAdvance: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    // ✅ Phase Projet — icônes use cases (P1.6)
    house:     '<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-5h6v5"/>',
    building:  '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>',
    apartment: '<rect x="3" y="3" width="18" height="18" rx="1"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><rect x="11" y="17" width="2" height="4"/>',
    parking:   '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V8h4.5a3 3 0 0 1 0 6H9"/>',
    factory:   '<path d="M3 21h18"/><path d="M3 21V9l5 3V9l5 3V9l5 3v9"/><rect x="6" y="14" width="2" height="3"/><rect x="11" y="14" width="2" height="3"/><rect x="16" y="14" width="2" height="3"/>',
  };

  function svgIcon(name) {
    const d = ICONS[name] || '';
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  // ─── Définitions des chips par champ ──────────────────────────────────
  // ✅ Phase 3.5 (F4) — Construction dynamique via i18n T() pour FR/EN/IT/ES/DE
  // cols = colonnes desktop (>=520px), colsNarrow = colonnes étroites
  function tr(key, fallback) {
    try {
      const v = _T(key);
      return (v && v !== key) ? v : fallback;
    } catch {}
    return fallback;
  }
  function getChipDefs() {
    return {
      emplacement: {
        cols: 2,
        options: [
          { value: 'interieur', label: tr('cce_emp_int_label', 'Intérieur'), sub: tr('cce_emp_int_sub', 'IP40+ • dôme/turret'), icon: 'home' },
          { value: 'exterieur', label: tr('cce_emp_ext_label', 'Extérieur'), sub: tr('cce_emp_ext_sub', 'IP66+ • IK10 • IR'),    icon: 'cloud' },
        ],
      },
      objective: {
        cols: 2, // 4 chips sur 2 lignes de 2
        options: [
          { value: 'detection',      label: tr('cce_obj_det_label',  'Détection'),      sub: tr('cce_obj_det_sub',  '25 PPM • présence'),    icon: 'user' },
          { value: 'observation',    label: tr('cce_obj_obs_label',  'Observation'),    sub: tr('cce_obj_obs_sub',  '63 PPM • scène'),       icon: 'eye' },
          { value: 'reconnaissance', label: tr('cce_obj_reco_label', 'Reconnaissance'), sub: tr('cce_obj_reco_sub', '125 PPM • personne'),   icon: 'search' },
          { value: 'identification', label: tr('cce_obj_iden_label', 'Identification'), sub: tr('cce_obj_iden_sub', '250 PPM • visage'),     icon: 'idCard' },
        ],
      },
      mounting: {
        cols: 2,
        options: [
          { value: 'wall',    label: tr('cce_mnt_wall_label', 'Mur'),     sub: tr('cce_mnt_wall_sub', 'Préféré bullets'),  icon: 'wall' },
          { value: 'ceiling', label: tr('cce_mnt_ceil_label', 'Plafond'), sub: tr('cce_mnt_ceil_sub', 'Préféré dômes'),    icon: 'ceiling' },
        ],
      },
      quality: {
        cols: 3,
        options: [
          { value: 'low',      label: tr('cce_q_low_label',  'Éco'),      sub: tr('cce_q_low_sub',  'Entrée de gamme'), icon: 'coin' },
          { value: 'standard', label: tr('cce_q_std_label',  'Standard'), sub: tr('cce_q_std_sub',  'Recommandé'),       icon: 'star' },
          { value: 'high',     label: tr('cce_q_high_label', 'HD'),       sub: tr('cce_q_high_sub', '5+ MP • IA enrichie'), icon: 'diamond' },
        ],
      },
      force_camera_type: {
        cols: 3,
        options: [
          { value: '',              label: tr('cce_ft_std_label',  'Standard'),     sub: tr('cce_ft_std_sub',  'Auto-sélection'),           icon: 'cog' },
          { value: 'ptz',           label: tr('cce_ft_ptz_label',  'PTZ'),          sub: tr('cce_ft_ptz_sub',  'Motorisée • zoom'),         icon: 'ptz' },
          { value: 'panoramic_180', label: tr('cce_ft_pano_label', 'Panoramique'),  sub: tr('cce_ft_pano_sub', '180° • multi-capteur'),    icon: 'panoramic' },
        ],
      },
      ai_type: {
        cols: 2,
        options: [
          { value: 'next',    label: tr('cce_ai_next_label', 'IA NEXT'),    sub: tr('cce_ai_next_sub', 'Intrusion humaine'),         icon: 'aiNext' },
          { value: 'advance', label: tr('cce_ai_adv_label',  'IA ADVANCE'), sub: tr('cce_ai_adv_sub',  'LPR • comptage • métadonnées'), icon: 'aiAdvance' },
        ],
      },
      // ✅ Phase Projet — Type de site (use case)
      // P1.6 : retiré Intrusion humaine x2 (géré côté caméra via ai_type) ; ajout Parking + Industriel
      use_case: {
        cols: 3, // 5 chips → 3+2 sur grand écran
        options: [
          { value: 'Résidentiel',        label: tr('cce_uc_res_label', 'Résidentiel'),        sub: tr('cce_uc_res_sub', 'Maison • villa • pavillon'),           icon: 'house' },
          { value: 'Tertiaire',          label: tr('cce_uc_ter_label', 'Tertiaire'),          sub: tr('cce_uc_ter_sub', 'Bureau • commerce • hôtel'),          icon: 'building' },
          { value: 'Logement collectif', label: tr('cce_uc_col_label', 'Logement collectif'), sub: tr('cce_uc_col_sub', 'Copropriété • HLM • résidence'),     icon: 'apartment' },
          { value: 'Parking',            label: tr('cce_uc_park_label', 'Parking'),           sub: tr('cce_uc_park_sub', 'Sous-sol • extérieur • LPR'),        icon: 'parking' },
          { value: 'Industriel',         label: tr('cce_uc_ind_label', 'Industriel'),         sub: tr('cce_uc_ind_sub', 'Entrepôt • usine • logistique'),     icon: 'factory' },
        ],
      },
    };
  }
  // Compat : objet calculé une fois pour les usages directs (re-calculé à chaque enhanceSelect via getDefForSelect)
  let CHIP_DEFS = getChipDefs();

  // ─── Self-contained styles (vertical layout, scales well) ────────────
  const CSS = `
    /* Hide the original select but keep accessible */
    .cce-hidden{
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0,0,0,0) !important;
      white-space: nowrap !important;
      border: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    .cce-wrap{
      margin-top: 6px;
    }

    .cce-group{
      display: grid;
      gap: 6px;
    }
    .cce-group[data-cols="2"]{ grid-template-columns: 1fr 1fr; }
    .cce-group[data-cols="3"]{ grid-template-columns: repeat(3, 1fr); }

    /* Chip : layout VERTICAL — icon haut, label centré bas */
    .cce-chip{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 9px 6px;
      min-height: 64px;
      background: #fff;
      border: 1.5px solid #E4E7EC;
      border-radius: 10px;
      cursor: pointer;
      transition: all .15s ease;
      font: inherit;
      text-align: center;
      color: #1C1F2A;
      -webkit-tap-highlight-color: transparent;
      box-sizing: border-box;
      width: 100%;
      position: relative;
      overflow: hidden;
    }
    .cce-chip:hover{
      border-color: #9AA0AE;
      background: #F7F8FA;
    }
    .cce-chip:active{ transform: scale(.98); }
    .cce-chip:focus-visible{
      outline: none;
      border-color: #00A56D;
      box-shadow: 0 0 0 3px rgba(0,165,109,.18);
    }
    .cce-chip[aria-pressed="true"]{
      border-color: #00A56D;
      background: linear-gradient(180deg, #F0F9F4 0%, #FAFEFC 100%);
      box-shadow:
        0 0 0 1px #00A56D inset,
        0 1px 2px rgba(0,165,109,.08);
    }

    /* Icon : 28×28 fixed, scales gracefully */
    .cce-chip-icon{
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      background: transparent;
      color: #6C7180;
      transition: all .15s ease;
    }
    .cce-chip[aria-pressed="true"] .cce-chip-icon{
      color: #00A56D;
    }
    /* Force SVG sizing — critical for proper rendering */
    .cce-chip-icon svg{
      display: block;
      width: 20px !important;
      height: 20px !important;
      flex-shrink: 0;
    }

    /* Label : compact, single-line with ellipsis */
    .cce-chip-label{
      font-size: 12.5px;
      font-weight: 700;
      color: #1C1F2A;
      letter-spacing: -0.01em;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cce-chip[aria-pressed="true"] .cce-chip-label{
      color: #007A50;
    }

    /* Sublabel : even smaller, gray */
    .cce-chip-sub{
      font-size: 10.5px;
      font-weight: 600;
      color: #9AA0AE;
      letter-spacing: -0.005em;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cce-chip[aria-pressed="true"] .cce-chip-sub{
      color: #00A56D;
    }

    /* Hide sublabel on extremely narrow chips (Quality 3-col on small recoCard) */
    @media(max-width: 380px){
      .cce-group[data-cols="3"] .cce-chip-sub{ display: none; }
      .cce-group[data-cols="3"] .cce-chip{ min-height: 56px; padding: 8px 4px; }
    }

    /* Compact mobile */
    @media(max-width: 480px){
      .cce-chip{ min-height: 58px; padding: 8px 4px; gap: 4px; }
      .cce-chip-icon{ width: 24px; height: 24px; }
      .cce-chip-icon svg{ width: 18px !important; height: 18px !important; }
      .cce-chip-label{ font-size: 11.5px; }
      .cce-chip-sub{ font-size: 9.5px; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('cce-styles')) return;
    const s = document.createElement('style');
    s.id = 'cce-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ─── HTML helpers ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildChip(opt, isActive) {
    return `
      <button type="button"
              class="cce-chip"
              data-value="${escapeHtml(opt.value)}"
              aria-pressed="${isActive ? 'true' : 'false'}"
              role="radio">
        <span class="cce-chip-icon">${svgIcon(opt.icon)}</span>
        <span class="cce-chip-label">${escapeHtml(opt.label)}</span>
        ${opt.sub ? `<span class="cce-chip-sub">${escapeHtml(opt.sub)}</span>` : ''}
      </button>
    `;
  }

  function buildGroup(def, currentValue) {
    const cols = def.cols || def.options.length;
    const chips = def.options
      .map((opt) => buildChip(opt, String(opt.value) === String(currentValue)))
      .join('');
    return `<div class="cce-group" data-cols="${cols}" role="radiogroup">${chips}</div>`;
  }

  // ─── Match a select to a CHIP_DEFS entry ─────────────────────────────
  function getDefForSelect(select) {
    // ✅ F4 — récupère les défs avec i18n courant à chaque appel
    CHIP_DEFS = getChipDefs();
    const field = select.dataset.field;
    if (field && CHIP_DEFS[field]) return { def: CHIP_DEFS[field], field };
    if (select.dataset.action === 'changeBlockQuality') return { def: CHIP_DEFS.quality, field: 'quality' };
    // ✅ Phase Projet — projUseCase → chips type de site
    if (select.dataset.action === 'projUseCase') return { def: CHIP_DEFS.use_case, field: 'use_case' };
    return null;
  }

  function normalizeValue(field, value) {
    if (!value) return value;
    if (field === 'emplacement') {
      const v = String(value).toLowerCase().trim();
      if (v === 'int' || v === 'interior' || v === 'inside') return 'interieur';
      if (v === 'ext' || v === 'exterior' || v === 'outside') return 'exterieur';
    }
    if (field === 'objective' && value === 'dissuasion') return 'observation';
    return value;
  }

  // ─── Enhance one select ──────────────────────────────────────────────
  function enhanceSelect(select) {
    if (!select || select.dataset.cceEnhanced === '1') return;

    const match = getDefForSelect(select);
    if (!match) return;

    let { def, field } = match;
    const current = normalizeValue(field, select.value);

    // ✅ CAM.1 — Filtrer les valeurs exclues via data-cce-exclude="ptz,panoramic_180"
    //           Permet au caller (HTML) de masquer dynamiquement certaines options
    const excludeRaw = select.dataset.cceExclude || "";
    if (excludeRaw.trim()) {
      const excludeSet = new Set(excludeRaw.split(",").map(s => s.trim()).filter(Boolean));
      def = { ...def, options: def.options.filter(opt => !excludeSet.has(String(opt.value))) };
    }

    // Remove inline border style (chips are the new visual indicator)
    if (select.style) {
      select.style.border = '';
      select.style.background = '';
    }

    // Build wrapper and insert before the select
    const wrapper = document.createElement('div');
    wrapper.className = 'cce-wrap';
    wrapper.dataset.field = field;
    wrapper.innerHTML = buildGroup(def, current);

    select.parentNode.insertBefore(wrapper, select);

    // Hide the select
    select.classList.add('cce-hidden');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    select.dataset.cceEnhanced = '1';

    // Click handler
    wrapper.addEventListener('click', function (e) {
      const btn = e.target.closest('.cce-chip');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const newValue = btn.dataset.value;
      if (newValue == null) return;

      // Update visual state
      wrapper.querySelectorAll('.cce-chip').forEach((b) => {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });

      // Update underlying select
      let opt = Array.from(select.options).find((o) => o.value === newValue);
      if (!opt && field === 'objective' && newValue === 'observation') {
        opt = Array.from(select.options).find((o) => o.value === 'dissuasion');
      }
      select.value = opt ? opt.value : newValue;

      // Trigger change so app.js's listeners fire
      select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      select.dispatchEvent(new Event('input',  { bubbles: true, cancelable: true }));
    });

    // Sync chips when select changes externally
    select.addEventListener('change', () => {
      const v = normalizeValue(field, select.value);
      wrapper.querySelectorAll('.cce-chip').forEach((b) => {
        const isActive = String(b.dataset.value) === String(v);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  }

  // ─── Scan and enhance ────────────────────────────────────────────────
  function enhanceAll(root) {
    const scope = root || document;
    const selects = scope.querySelectorAll(
      'select[data-field="emplacement"]:not(.cce-hidden),' +
      'select[data-field="objective"]:not(.cce-hidden),' +
      'select[data-field="mounting"]:not(.cce-hidden),' +
      'select[data-field="force_camera_type"]:not(.cce-hidden),' +
      'select[data-field="ai_type"]:not(.cce-hidden),' +
      'select[data-action="changeBlockQuality"]:not(.cce-hidden),' +
      'select[data-action="projUseCase"]:not(.cce-hidden)'
    );
    selects.forEach(enhanceSelect);
  }

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    enhanceAll();

    const observer = new MutationObserver((mutations) => {
      let hit = false;
      for (const m of mutations) {
        if (!m.addedNodes || !m.addedNodes.length) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (
            n.matches?.('select[data-field], select[data-field="force_camera_type"], select[data-action="changeBlockQuality"], select[data-action="projUseCase"]') ||
            n.querySelector?.('select[data-field], select[data-field="force_camera_type"], select[data-action="changeBlockQuality"], select[data-action="projUseCase"]')
          ) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) setTimeout(() => enhanceAll(), 0);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
