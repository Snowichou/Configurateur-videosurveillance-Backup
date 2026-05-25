// render/pdf-blob.js
// ✅ Phase 2 — PH2.23 : buildPdfBlobProFromProject extraite depuis app.js
// Module ESM — dépendances métier injectées via deps ;
// les globaux navigateur (document, window, fetch, FileReader) restent implicites.

export async function buildPdfBlobProFromProjectPure(proj, deps = {}) {
  const {
    T,
    LAST_PROJECT,
    computeProject,
    buildPdfHtml,
    CATALOG,
  } = deps;
  // SÉCURITÉ : si proj est undefined, on le récupère
  if (!proj) {
    proj = (typeof LAST_PROJECT !== "undefined" && LAST_PROJECT)
      ? LAST_PROJECT
      : (typeof computeProject === "function" ? computeProject() : null);
  }
  
  if (!proj) {
    throw new Error(T("err_project_unavailable"));
  }

  // 1) Créer le container offscreen
  const host = document.createElement("div");
  host.id = "pdfHost";
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "210mm",
    minHeight: "297mm",
    background: "#ffffff",
    color: "#000",
    zIndex: "-9999",
    opacity: "0.001",
    pointerEvents: "none",
    overflow: "visible",
  });

  // 2) Injecter le HTML
  try {
    host.innerHTML = buildPdfHtml(proj);
  } catch (e) {
    console.error("[PDF] buildPdfHtml failed:", e);
    throw new Error("Impossible de générer le HTML du PDF: " + e.message);
  }
  
  document.body.appendChild(host);
  const root = host.querySelector("#pdfReportRoot") || host;

  // 3) Helpers pour les images
  const blobToDataURL = (blob) =>
    new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    });

  // Résout l'URL CDN depuis le catalogue (flat list ou ACCESSORIES_MAP)
  const resolveCdnFromCatalog = (family, id) => {
    try {
      // Cas standard : liste plate (cameras, nvrs, hdds, switches, screens, enclosures, signage)
      const flatMap = {
        cameras: CATALOG?.CAMERAS, nvrs: CATALOG?.NVRS,
        hdds: CATALOG?.HDDS, switches: CATALOG?.SWITCHES,
        screens: CATALOG?.SCREENS, enclosures: CATALOG?.ENCLOSURES,
        signage: CATALOG?.SIGNAGE,
      };
      const list = flatMap[family];
      if (Array.isArray(list)) {
        const obj = list.find(x => x.id === id);
        if (obj?.image_url && obj.image_url !== "false") return obj.image_url;
      }

      // Cas accessoires : ACCESSORIES_MAP indexé par camera_id
      // Structure : { cameraId, junction, wall, ceiling }  (pas un tableau)
      if (family === "accessories" && CATALOG?.ACCESSORIES_MAP instanceof Map) {
        for (const [, mapping] of CATALOG.ACCESSORIES_MAP) {
          for (const slot of ["junction", "wall", "ceiling"]) {
            const acc = mapping?.[slot];
            if (acc?.accessoryId === id && acc?.image_url && acc.image_url !== "false") {
              return acc.image_url;
            }
          }
        }
      }
    } catch {}
    return null;
  };

  const inlineLocalImage = async (url) => {
    const u = String(url || "").trim();
    if (!u || /^data:/i.test(u)) return u;

    // ── Cas 1 : chemin local /data/Images/<family>/<ID>.png ──
    // Plus de fichiers locaux → remonter au catalogue pour l'URL CDN
    if (u.startsWith("/data/Images/")) {
      const parts = u.split("/");
      const family = (parts[3] || "").toLowerCase();
      const id = (parts[4] || "").replace(/\.png$/i, "").replace(/%20/g, " ");
      const cdnUrl = resolveCdnFromCatalog(family, id);
      if (cdnUrl) {
    try {
          const res = await fetch(`/api/img-proxy?url=${encodeURIComponent(cdnUrl)}`, { cache: "force-cache" });
          if (res.ok) { const blob = await res.blob(); if (blob.size > 0) return await blobToDataURL(blob); }
        } catch {}
      }
      return null; // Pas de fallback local
    }

    // ── Cas 2 : URL externe CDN (https://staticpro...) → proxy backend ──
    if (u.startsWith("http") && !u.includes(window.location.host)) {
      try {
        const res = await fetch(`/api/img-proxy?url=${encodeURIComponent(u)}`, { cache: "force-cache" });
        if (res.ok) { const blob = await res.blob(); if (blob.size > 0) return await blobToDataURL(blob); }
      } catch {}
      return null;
    }

    // ── Cas 3 : URL locale même origine (/assets/logo.png) → fetch direct ──
    try {
      const res = await fetch(u, { cache: "force-cache" });
      if (res.ok) { const blob = await res.blob(); if (blob.size > 0) return await blobToDataURL(blob); }
    } catch {}
    return null;
  };

  const inlineAllImages = async () => {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (!src || /^data:/i.test(src)) return;
        const dataUrl = await inlineLocalImage(src);
        if (dataUrl) {
          img.setAttribute("src", dataUrl);
          img.removeAttribute("crossorigin");
          img.style.display = "";
        } else {
          // Masquer proprement pour que html2canvas ne tente pas de charger l'URL
          img.style.display = "none";
          img.removeAttribute("src");
        }
      })
    );
  };

  const waitForImages = () => {
    const imgs = Array.from(root.querySelectorAll("img"));
    return Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalHeight > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 3000);
          })
      )
    );
  };

  // 4) Rendu canvas
  const renderToCanvas = async (element, widthPx, heightPx = null) => {
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas manquant");
    }

    const prevWidth = element.style.width;
    const prevHeight = element.style.height;
    const prevOverflow = element.style.overflow;
    
    element.style.width = `${widthPx}px`;
    if (heightPx) element.style.height = `${heightPx}px`;
    element.style.overflow = "hidden";

    element.offsetHeight;
    await new Promise(r => setTimeout(r, 50));

    const canvas = await window.html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      width: widthPx,
      height: heightPx || element.scrollHeight,
      windowWidth: widthPx,
      windowHeight: heightPx || element.scrollHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });

    element.style.width = prevWidth;
    element.style.height = prevHeight;
    element.style.overflow = prevOverflow;

    return canvas;
  };

  // 5) Ajouter canvas au PDF (centré)
  const addCanvasToPdf = (pdf, canvas) => {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    
    const imgW = canvas.width / 2;
    const imgH = canvas.height / 2;
    
    const ratioW = pageW / imgW;
    const ratioH = pageH / imgH;
    const ratio = Math.min(ratioW, ratioH);
    
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    
    pdf.addImage(imgData, "JPEG", x, y, drawW, drawH, undefined, "FAST");
  };

  // 6) Vérifier dépendances
  const JsPDF = window?.jspdf?.jsPDF || window?.jsPDF;
  if (typeof JsPDF !== "function") {
    host.remove();
    throw new Error("jsPDF manquant");
  }
  if (typeof window.html2canvas !== "function") {
    host.remove();
    throw new Error("html2canvas manquant");
  }

  try {
    if (document.fonts?.ready) await document.fonts.ready;

    await inlineAllImages();
    await waitForImages();
    await new Promise(r => setTimeout(r, 100));

    const allPages = Array.from(root.querySelectorAll(".pdfPage"));
    if (!allPages.length) throw new Error("Aucune page .pdfPage trouvée");

    const portraitPages = allPages.filter(p => !p.classList.contains("pdfPageLandscape"));
    const landscapePages = allPages.filter(p => p.classList.contains("pdfPageLandscape"));

    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const A4_W_PX = 794;
    const A4_H_PX = 1123;
    const A4_LAND_W_PX = 1123;
    const A4_LAND_H_PX = 794;

    // Pages portrait
    for (let i = 0; i < portraitPages.length; i++) {
      const page = portraitPages[i];
      page.style.width = "210mm";
      page.style.height = "297mm";
      page.style.boxSizing = "border-box";
      
      await new Promise(r => setTimeout(r, 30));
      const canvas = await renderToCanvas(page, A4_W_PX, A4_H_PX);
      
      if (i > 0) pdf.addPage("a4", "portrait");
      addCanvasToPdf(pdf, canvas);
    }

    // Pages paysage (synoptique)
    for (let i = 0; i < landscapePages.length; i++) {
      const page = landscapePages[i];
      page.style.width = "297mm";
      page.style.height = "210mm";
      page.style.boxSizing = "border-box";
      host.style.width = "297mm";
      
      await new Promise(r => setTimeout(r, 80));
      const canvas = await renderToCanvas(page, A4_LAND_W_PX, A4_LAND_H_PX);
      
      pdf.addPage("a4", "landscape");
      addCanvasToPdf(pdf, canvas);
    }

    return pdf.output("blob");

  } finally {
    host.remove();
  }
}




// =====

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
}
