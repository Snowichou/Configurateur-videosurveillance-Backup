// render/pipeline.js
// ✅ Phase 3 — PH3.8 : pipeline de rendu extrait depuis app.js (pattern factory)
// createRenderPipeline(deps) → { syncResultsUI, updateNavButtons, updateProgress, render, _renderImmediate }

export function createRenderPipeline(deps = {}) {
  const {
    MODEL = {},
    STEPS = [],
    DOM = {},
    T = (k) => k,
    validateStep = null,
    renderStepProject = null,
    renderStepCameras = null,
    renderStepMounts = null,   // alias compat de renderStepAccessories
    renderStepNvrNetwork = null,
    renderStepStorage = null,
    renderStepComplements = null,
    renderStepSummary = null,
    bindSummaryButtons = null,
    safeHtml = (s) => String(s ?? ''),
  } = deps;

  // État interne : handle du requestAnimationFrame en cours
  const _renderRAFRef = { value: null };


  function syncResultsUI() {
    const stepId = STEPS[MODEL.stepIndex]?.id;
    const isSummary = (stepId === "summary");
  
    const isLastStep = MODEL.stepIndex >= (STEPS.length - 1);
  
    const resultsEmpty = document.getElementById("resultsEmpty");
    const results = document.getElementById("results");
  
    const gridEl = document.querySelector("#mainGrid") || document.querySelector(".appGrid");
    const resultCard = document.querySelector("#resultCard") || document.querySelector("#resultsCard") || document.querySelector(".resultsCard");
  
    // ✅ Sur SUMMARY : on veut 1 colonne et ZERO carte résultats (car le résumé est dans l’étape)
    if (isSummary) {
      if (gridEl) gridEl.classList.add("singleCol");
      if (resultCard) resultCard.classList.add("hiddenCard");
      if (results) results.classList.add("hidden");
      if (resultsEmpty) resultsEmpty.classList.add("hidden");
      return;
    }
  
    // Hors summary : comportement normal
    // Résultats visibles uniquement sur la dernière étape (si tu gardes cette logique)
    if (!isLastStep && MODEL.ui.resultsShown) MODEL.ui.resultsShown = false;
  
    if (resultsEmpty) resultsEmpty.classList.toggle("hidden", isLastStep);
    if (results) results.classList.toggle("hidden", !isLastStep);
  
    const showCol = isLastStep && MODEL.ui.resultsShown && stepId !== "summary";
    if (stepId === "summary") {
    DOM.mainGrid?.classList.add("singleCol");
    DOM.resultsCard?.classList.add("hiddenCard");
  }
  
  
    if (gridEl) gridEl.classList.toggle("singleCol", !showCol);
    if (resultCard) resultCard.classList.toggle("hiddenCard", !isLastStep);
  }

  function updateNavButtons() {
    const stepId = STEPS[MODEL.stepIndex]?.id;
  
    const btnPrev = document.getElementById("btnPrev");
  if (btnPrev) {
    if (MODEL.stepIndex > 0) {
      btnPrev.style.display = "inline-flex";
      btnPrev.disabled = false;
    } else {
      btnPrev.style.display = "none";
    }
  }
    if (!DOM.btnCompute) return;
  
    if (stepId === "summary") {
      DOM.btnCompute.disabled = true;
      DOM.btnCompute.textContent = T("sum_finished");
      return;
    }
  
    // Validation visuelle du bouton selon l'étape
    const stepErrors = typeof validateStep === "function" ? validateStep(stepId) : [];
    if (stepErrors.length > 0) {
      DOM.btnCompute.classList.add("btnDisabledHint");
      DOM.btnCompute.title = stepErrors[0];
    } else {
      DOM.btnCompute.classList.remove("btnDisabledHint");
      DOM.btnCompute.title = "";
    }
    DOM.btnCompute.disabled = false;
  
    // Optionnel: libellés contextuels
    if (stepId === "complements") DOM.btnCompute.textContent = T("btn_finalize");
    else DOM.btnCompute.textContent = T("btn_next");
  }

  function updateProgress() {
      const currentStep = MODEL.stepIndex;
      const totalSteps = STEPS.length;
      const currentStepData = STEPS[currentStep];
      
      // Ancien système (pour compatibilité)
      const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
      if (DOM.progressBar) DOM.progressBar.style.width = `${pct}%`;
      if (DOM.progressText) DOM.progressText.textContent = `Étape ${currentStep + 1}/${totalSteps} • ${pct}%`;
      
      // ✅ NOUVEAU : Mise à jour du titre de la section
      const stepperTitle = document.getElementById('stepperTitle');
      const stepperSubtitle = document.getElementById('stepperSubtitle');
      
      if (stepperTitle && currentStepData) {
        stepperTitle.textContent = currentStepData.title || 'Configuration';
      }
      
      if (stepperSubtitle && currentStepData) {
        stepperSubtitle.textContent = currentStepData.help || '';
      }
      
      // ✅ Mise à jour du stepper visuel
      const stepper = document.getElementById('stepper');
      if (stepper) {
        const steps = stepper.querySelectorAll('.stepperStep');
        const lines = stepper.querySelectorAll('.stepperLine');
        
        steps.forEach((stepEl, index) => {
          stepEl.classList.remove('completed', 'active', 'future');
          
          if (index < currentStep) {
            stepEl.classList.add('completed');
          } else if (index === currentStep) {
            stepEl.classList.add('active');
          } else {
            stepEl.classList.add('future');
          }
        });
        
        lines.forEach((lineEl, index) => {
          lineEl.classList.remove('completed');
          if (index < currentStep) {
            lineEl.classList.add('completed');
          }
        });
      }
    }

  function render() {
    if (_renderRAFRef.value) cancelAnimationFrame(_renderRAFRef.value);
    _renderRAFRef.value = requestAnimationFrame(_renderImmediate);
  }

  function _renderImmediate() {
    _renderRAFRef.value = null;
    if (!Array.isArray(STEPS) || !STEPS.length) return;
  
    if (!Number.isFinite(MODEL.stepIndex)) MODEL.stepIndex = 0;
    MODEL.stepIndex = Math.max(0, Math.min(MODEL.stepIndex, STEPS.length - 1));
  
    const stepId = STEPS[MODEL.stepIndex]?.id;
  
    let html = "";
  
    if (stepId === "project") {
      html = renderStepProject();
    } else if (stepId === "cameras") {
      html = renderStepCameras();
    } else if (stepId === "mounts") {
      html = renderStepMounts();
    } else if (stepId === "nvr_network") {
      html = renderStepNvrNetwork();
    } else if (stepId === "storage") {
      html = renderStepStorage();
    } else if (stepId === "complements") {
      html = renderStepComplements();
    } else if (stepId === "summary") {
      html = renderStepSummary();
    } else {
    html = `<div class="recoCard" style="padding:12px"><div class="muted">Étape inconnue : ${safeHtml(stepId || "—")}</div></div>`;
    }
  
    DOM.stepsEl.innerHTML = html;
  
    bindSummaryButtons();
    syncResultsUI?.();
    updateNavButtons();
    updateProgress();
  }

  return { syncResultsUI, updateNavButtons, updateProgress, render, _renderImmediate };
}

if (typeof window !== 'undefined') {
}
