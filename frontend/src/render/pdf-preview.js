// render/pdf-preview.js
// ✅ Phase 2 — PH2.25 : showPdfPreview extraite depuis app.js
// Module ESM — dépendances injectées via deps ;
// les globaux navigateur (document, window) restent implicites.

export function showPdfPreviewPure(deps = {}) {
  const {
    T,
    getLastProject,
    computeProject,
    buildPdfHtml,
    exportProjectPdfPro,
  } = deps;
  const proj = (typeof getLastProject === "function" ? getLastProject() : null)
    ?? (typeof computeProject === "function" ? computeProject() : null);
  
  if (!proj) {
    alert("Projet non disponible. Finalisez d'abord la configuration.");
    return;
  }
  
  let html;
  try {
    html = buildPdfHtml(proj);
  } catch (e) {
    alert("Erreur lors de la génération de l'aperçu : " + e.message);
    return;
  }
  
  // Créer la modale
  const overlay = document.createElement("div");
  overlay.id = "pdfPreviewOverlay";
  
  // Injecter le CSS responsive + structure
  overlay.innerHTML = `
    <style>
      #pdfPreviewOverlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.75);
        display: flex; flex-direction: column; align-items: center;
        overflow-y: auto; -webkit-overflow-scrolling: touch;
        padding: 12px;
        backdrop-filter: blur(4px);
      }
      .prevToolbar {
        display: flex; gap: 8px; margin-bottom: 12px;
        padding: 10px 16px; background: #1C1F2A; border-radius: 12px;
        align-items: center; flex-shrink: 0;
        width: 100%; max-width: 860px;
        flex-wrap: wrap;
        position: sticky; top: 0; z-index: 2;
      }
      .prevToolbar .prevTitle {
        color: #fff; font-weight: 900; font-size: 14px; margin-right: auto;
      }
      .prevToolbar button {
        padding: 8px 14px; border-radius: 8px; border: none;
        font-weight: 700; cursor: pointer; font-size: 13px;
        white-space: nowrap;
      }
      .prevBtnExport { background: #00BC70; color: #fff; }
      .prevBtnClose { background: #dc2626; color: #fff; }
      .prevBtnExport:hover { background: #00a060; }
      .prevBtnClose:hover { background: #b91c1c; }

      .prevContainer {
        display: flex; flex-direction: column; gap: 20px;
        align-items: center; width: 100%; max-width: 860px;
        padding-bottom: 40px;
      }
      .prevPageWrap {
        background: #ffffff; border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        width: 100%; overflow: hidden;
        position: relative;
      }
      .prevPageWrap .pdfPage {
        width: 210mm; height: auto !important; min-height: 280mm;
        transform-origin: top left;
        overflow: visible !important;
      }
      .prevPageWrap .pdfPageLandscape {
        width: 297mm; height: auto !important; min-height: 190mm;
        transform-origin: top left;
      }
      .prevPageLabel {
        position: absolute; top: 8px; right: 12px;
        background: rgba(0,0,0,0.5); color: #fff;
        padding: 3px 10px; border-radius: 6px;
        font-size: 11px; font-weight: 700; z-index: 3;
      }

      @media (max-width: 900px) {
        #pdfPreviewOverlay { padding: 8px; }
        .prevToolbar { padding: 8px 12px; }
        .prevToolbar .prevTitle { font-size: 12px; }
        .prevToolbar button { padding: 6px 10px; font-size: 12px; }
      }
    </style>

    <div class="prevToolbar">
      <span class="prevTitle">${"👁️ " + T("sum_preview") + " PDF"}</span>
      <button class="prevBtnExport" id="previewExportBtn">📄 Exporter PDF</button>
      <button class="prevBtnClose" id="previewCloseBtn">✕ Fermer</button>
    </div>
    <div class="prevContainer" id="prevContainer"></div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  
  // Parser le HTML du PDF et séparer les pages
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const pdfRoot = tempDiv.querySelector("#pdfReportRoot") || tempDiv;
  const pages = Array.from(pdfRoot.querySelectorAll(".pdfPage"));
  const container = overlay.querySelector("#prevContainer");
  
  // Récupérer le <style> du PDF pour l'injecter dans chaque page
  const pdfStyle = pdfRoot.querySelector("style");
  const styleHtml = pdfStyle ? pdfStyle.outerHTML : "";
  
  pages.forEach((page, i) => {
    const isLandscape = page.classList.contains("pdfPageLandscape");
    const wrap = document.createElement("div");
    wrap.className = "prevPageWrap";
    
    // Label de page
    const label = document.createElement("div");
    label.className = "prevPageLabel";
    label.textContent = `Page ${i + 1}/${pages.length}${isLandscape ? " (paysage)" : ""}`;
    wrap.appendChild(label);
    
    // Clone de la page
    const clone = page.cloneNode(true);
    clone.style.margin = "0";
    
    // Injecter les styles
    const styleEl = document.createElement("div");
    styleEl.innerHTML = styleHtml;
    wrap.appendChild(styleEl);
    wrap.appendChild(clone);
    
    container.appendChild(wrap);
  });
  
  // Responsive : adapter le scale des pages à la largeur du container
  const fitPages = () => {
    const containerWidth = container.clientWidth || 800;
    container.querySelectorAll(".prevPageWrap").forEach((wrap) => {
      const page = wrap.querySelector(".pdfPage");
      if (!page) return;
      const isLandscape = page.classList.contains("pdfPageLandscape");
      const pageNativeWidth = isLandscape ? 1123 : 794; // 297mm or 210mm in px @96dpi
      const scale = Math.min(1, containerWidth / pageNativeWidth);
      page.style.transform = `scale(${scale})`;
      page.style.transformOrigin = "top left";
      // Adapter la hauteur du wrapper
      const nativeHeight = isLandscape ? 560 : 1123;
      wrap.style.height = `${nativeHeight * scale}px`;
    });
  };
  
  fitPages();
  window.addEventListener("resize", fitPages);
  
  // Cleanup handler
  const cleanup = () => {
    overlay.remove();
    document.body.style.overflow = "";
    window.removeEventListener("resize", fitPages);
    document.removeEventListener("keydown", escHandler);
  };
  
  // Bind events
  overlay.querySelector("#previewCloseBtn").addEventListener("click", cleanup);
  overlay.querySelector("#previewExportBtn").addEventListener("click", () => {
    cleanup();
    if (typeof exportProjectPdfPro === "function") exportProjectPdfPro();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cleanup();
  });
  
  // Escape key
  const escHandler = (e) => {
    if (e.key === "Escape") cleanup();
  };
  document.addEventListener("keydown", escHandler);
}

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
  window._showPdfPreviewPure = showPdfPreviewPure;
}
