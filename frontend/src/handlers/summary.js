// handlers/summary.js
// ✅ Phase 4 — PH4.1 : bindSummaryButtons extrait depuis app.js
// Appelé depuis _renderImmediate après chaque rendu sur l'étape "summary".

export function bindSummaryButtonsPure(deps = {}) {
  const {
    MODEL = {},
    STEPS = [],
    T = (k) => k,
    syncResultsUI = null,
    render = null,
    exportProjectPdfPro = null,
    showPdfPreview = null,
    exportProjectPdfPackPro = null,
    saveConfigToLocalStorage = null,
    shareConfigUrl = null,
    requestQuote = null,
    sendToDistributor = null,
  } = deps;

  const stepId = STEPS[MODEL.stepIndex]?.id;
  if (stepId !== "summary") return;

  const btnBack = document.getElementById("btnBackToEdit");
  if (btnBack && !btnBack.dataset.bound) {
    btnBack.dataset.bound = "1";
    btnBack.addEventListener("click", () => {
      const compIdx = STEPS.findIndex(s => s.id === "complements");
      if (compIdx >= 0) {
        MODEL.stepIndex = compIdx;
        MODEL.ui.resultsShown = false;
        if (typeof syncResultsUI === "function") syncResultsUI();
        if (typeof render === "function") render();
      }
    });
  }

  const btnPdf = document.getElementById("btnExportPdf");
  if (btnPdf && !btnPdf.dataset.bound) {
    btnPdf.dataset.bound = "1";
    btnPdf.addEventListener("click", () => {
      if (typeof exportProjectPdfPro === "function") exportProjectPdfPro();
      else alert("Export PDF indisponible.");
    });
  }

  const btnPreview = document.getElementById("btnPreviewPdf");
  if (btnPreview && !btnPreview.dataset.bound) {
    btnPreview.dataset.bound = "1";
    btnPreview.addEventListener("click", () => {
      if (typeof showPdfPreview === "function") showPdfPreview();
      else alert(T("sum_preview") + " — N/A");
    });
  }

  const btnPack = document.getElementById("btnExportPdfPack");
  if (btnPack && !btnPack.dataset.bound) {
    btnPack.dataset.bound = "1";
    btnPack.addEventListener("click", () => {
      if (typeof exportProjectPdfPackPro === "function") exportProjectPdfPackPro();
      else alert("Export pack indisponible.");
    });
  }

  const btnSave = document.getElementById("btnSaveConfig");
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = "1";
    btnSave.addEventListener("click", () => {
      if (typeof saveConfigToLocalStorage === "function") saveConfigToLocalStorage();
    });
  }

  const btnShare = document.getElementById("btnShareConfig");
  if (btnShare && !btnShare.dataset.bound) {
    btnShare.dataset.bound = "1";
    btnShare.addEventListener("click", () => {
      if (typeof shareConfigUrl === "function") shareConfigUrl();
    });
  }

  const btnQuote = document.getElementById("btnRequestQuote");
  if (btnQuote && !btnQuote.dataset.bound) {
    btnQuote.dataset.bound = "1";
    btnQuote.addEventListener("click", () => {
      if (typeof requestQuote === "function") requestQuote();
    });
  }

  const btnDistrib = document.getElementById("btnSendToDistributor");
  if (btnDistrib && !btnDistrib.dataset.bound) {
    btnDistrib.dataset.bound = "1";
    btnDistrib.addEventListener("click", () => {
      if (typeof sendToDistributor === "function") sendToDistributor();
    });
  }
}

if (typeof window !== 'undefined') {
  window._bindSummaryButtonsPure = bindSummaryButtonsPure;
}
