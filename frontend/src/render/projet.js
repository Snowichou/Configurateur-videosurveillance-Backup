// ============================================================
// render/projet.js — Étape 0 du wizard (Projet)
// ============================================================
//
// Premier module render/ extrait de app.js (Phase 2 refactor).
//
// La fonction renderStepProject construit le HTML de l'étape Projet
// (nom du projet, type de site, tags, notes) à partir d'un MODEL
// et de helpers i18n/HTML injectés.
//
// Aucune dépendance à un global : tout passe par `deps`. Elle
// retourne uniquement une string HTML — c'est au caller de l'injecter
// dans le DOM (innerHTML d'un container).
//
// Les "side cards" qui dépendent de l'environnement (config locale,
// SSO Azure) sont pré-rendues par le caller et passées via
// `deps.saveCardHtml` / `deps.cloudCardHtml`. Ainsi le module reste pur.
// ============================================================

import { safeHtml as defaultSafeHtml } from '../utils/format.js';

// Liste fixe des chips proposés à l'utilisateur (Phase Projet P1.6).
// Les variantes Intrusion sont gérées côté caméra via `ai_type`.
const PROJ_USE_CASES_FIXED = Object.freeze([
  'Résidentiel',
  'Tertiaire',
  'Logement collectif',
  'Parking',
  'Industriel',
]);

/**
 * Fusionne la liste fixe + les use_cases du catalogue,
 * en excluant ceux qui contiennent "Intrusion".
 *
 * @param {string[]} [csvUseCases=[]]
 * @returns {string[]}
 */
export function mergeProjectUseCases(csvUseCases = []) {
  const extras = (csvUseCases || []).filter((u) => u && !String(u).includes('Intrusion'));
  return Array.from(new Set([...PROJ_USE_CASES_FIXED, ...extras]));
}

/**
 * Identité — fallback si aucun helper i18n n'est injecté.
 * @param {string} key
 */
const identityT = (key) => String(key ?? '');

/**
 * Rendu de l'étape "Projet" du wizard.
 *
 * @param {Object}  deps
 * @param {Object}  deps.model             - MODEL (lit projectName/UseCase/Tags/Notes)
 * @param {Function} [deps.T=identity]     - Fonction de traduction i18n
 * @param {Function} [deps.safeHtml]       - Échappement HTML
 * @param {string[]} [deps.csvUseCases=[]] - Use_cases issus du catalogue caméras
 * @param {Object}  [deps.limits]          - LIMITS (lit maxProjectNameLength)
 * @param {Function} [deps.projectTipHtml]        - (useCase) → html astuce
 * @param {Function} [deps.useCaseDescriptionHtml]- (useCase) → html description
 * @param {Function} [deps.translateUseCase]      - (useCase) → label i18n
 * @param {string}  [deps.saveCardHtml='']        - HTML pré-rendu (config locale / cloud)
 * @returns {string} HTML
 */
export function renderStepProject(deps = {}) {
  const model = deps.model || {};
  const T = typeof deps.T === 'function' ? deps.T : identityT;
  const sh = typeof deps.safeHtml === 'function' ? deps.safeHtml : defaultSafeHtml;
  const limits = deps.limits || {};
  const maxName = limits.maxProjectNameLength ?? 80;
  const projectTipHtml = typeof deps.projectTipHtml === 'function' ? deps.projectTipHtml : () => '';
  const useCaseDescriptionHtml =
    typeof deps.useCaseDescriptionHtml === 'function' ? deps.useCaseDescriptionHtml : () => '';
  const translateUseCase =
    typeof deps.translateUseCase === 'function' ? deps.translateUseCase : (u) => u;
  const saveCardHtml = typeof deps.saveCardHtml === 'string' ? deps.saveCardHtml : '';

  const val = model.projectName || '';
  const useCase = model.projectUseCase || '';
  const tags = model.projectTags || '';
  const notes = model.projectNotes || '';

  const useCases = mergeProjectUseCases(deps.csvUseCases);

  const isComplete = val.trim().length > 0 && useCase.trim().length > 0;

  const nameBorderColor = val.trim() ? 'var(--line)' : 'rgba(220,38,38,.4)';
  const useCaseBorderColor = useCase.trim() ? 'var(--line)' : 'rgba(220,38,38,.4)';

  const optionsHtml = useCases
    .map(
      (u) =>
        `<option value="${sh(u)}" ${useCase === u ? 'selected' : ''}>${sh(translateUseCase(u))}</option>`
    )
    .join('');

  return `
    <div class="stepSplit">
      <div class="blocksCol">
        <div class="recoCard" style="padding:14px">
          <div class="recoHeader">
            <div>
              <div class="recoName">${T('proj_title')}</div>
              <div class="muted">${T('proj_desc_old')}</div>
            </div>
            <div class="score">${isComplete ? '✅' : '🏠'}</div>
          </div>

          ${projectTipHtml(useCase)}

          <!-- Ligne 1 : Nom + Type site (2 colonnes) -->
          <div class="kv">
            <div>
              <strong>
                📌 ${T('proj_name')} <span class="fieldRequired">*</span>
                <span class="infoTip" data-tip="${sh(T('proj_name_hint_short'))}">i</span>
              </strong>
              <input
                data-action="projName"
                type="text"
                maxlength="${maxName}"
                value="${sh(val)}"
                placeholder="${sh(T('proj_name_placeholder_short'))}"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${nameBorderColor};background:var(--panel2);color:var(--text)"
              />
              <div class="muted" style="margin-top:6px;font-size:11px">
                ${sh(T('proj_name_hint_inline'))}
              </div>
            </div>
            <div>
              <strong>
                🏷️ ${T('proj_type')} <span class="fieldRequired">*</span>
                <span class="infoTip" data-tip="${sh(T('proj_type_hint'))}">i</span>
              </strong>
              <select
                data-action="projUseCase"
                style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${useCaseBorderColor};background:var(--panel2);color:var(--text)"
              >
                <option value="">${T('proj_type_select')}</option>
                ${optionsHtml}
              </select>
              ${useCaseDescriptionHtml(useCase)}
              <div class="muted" style="margin-top:6px;font-size:11px">
                ${T('proj_type_hint_short')}
              </div>
            </div>
          </div>

          <!-- Tags + Notes regroupés dans details collapsable (P1.4) -->
          <details class="projOptDetails" ${tags || notes ? 'open' : ''} style="margin-top:14px">
            <summary class="projOptSummary">
              <span class="projOptIcon">📋</span>
              <span class="projOptLabel">${sh(T('proj_optional_section'))}</span>
              <span class="projOptHint">${sh(T('proj_optional_hint'))}</span>
            </summary>
            <div class="kv" style="margin-top:10px">
              <div>
                <strong>
                  🏷️ ${T('proj_tags_label')}
                  <span class="infoTip" data-tip="${sh(T('proj_tags_tip'))}">i</span>
                </strong>
                <input
                  data-action="projTags"
                  type="text"
                  maxlength="200"
                  value="${sh(tags)}"
                  placeholder="${sh(T('proj_tags_placeholder'))}"
                  style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)"
                />
                <div class="muted" style="margin-top:6px;font-size:11px">
                  ${sh(T('proj_tags_hint'))}
                </div>
              </div>
              <div>
                <strong>
                  📝 ${T('proj_notes_label')}
                  <span class="infoTip" data-tip="${sh(T('proj_notes_tip'))}">i</span>
                </strong>
                <textarea
                  data-action="projNotes"
                  maxlength="3000"
                  rows="3"
                  placeholder="${sh(T('proj_notes_placeholder'))}"
                  style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-family:inherit;resize:vertical;min-height:80px;font-size:13px"
                >${sh(notes)}</textarea>
              </div>
            </div>
          </details>

          ${
            !isComplete
              ? `<div class="alert warn" style="margin-top:14px">⚠️ ${T('proj_incomplete')}</div>`
              : `<div class="alert ok" style="margin-top:14px">✅ ${T('proj_complete')}</div>`
          }
        </div>
      </div>

      <div class="proposalsCol">
        ${saveCardHtml}
        <div class="recoCard" style="padding:14px">
          <div class="recoName">${T('proj_preview')}</div>
          <div class="muted" style="margin-top:6px">
            ${T('proj_pdf_intro').replace('{0}', T('proj_title'))}<br>
            • ${T('proj_site_name')}<br>
            • ${T('proj_site_type_label')}<br>
            • ${T('proj_gen_date')}<br>
            • ${T('proj_score_label')}
          </div>
        </div>

        <div class="recoCard" style="padding:14px;margin-top:10px">
          <div class="recoName">${T('proj_why_type')}</div>
          <div class="muted" style="margin-top:6px">
            ${T('proj_why_type_desc')}<br>
            • ${T('proj_filter_cameras')}<br>
            • ${T('proj_preconfig')}<br>
            • ${T('proj_optimize')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Compat global (legacy app.js) ──────────────────────────
if (typeof window !== 'undefined') {
}
