// render/pdf-pro.js
// ✅ Phase 3 — PH3.2 : exportProjectPdfPro extraite depuis app.js
// Module ESM — dépendances injectées via deps ;
// globaux navigateur (document, window, URL) restent implicites.

export async function exportProjectPdfProPure(proj, deps = {}) {
  const {
    T,
    getLastProject,
    setLastProject,
    computeProject,
    buildPdfBlobProFromProject,
    kpiConfigSnapshot,
    KPI,
    MODEL,
  } = deps;
  if (!proj) {
    proj = (typeof getLastProject === "function" ? getLastProject() : null);
  }
  
  if (!proj && typeof computeProject === "function") {
    try {
      proj = computeProject();
      if (typeof setLastProject === "function") { setLastProject(proj); }
    } catch (e) {
      console.error("[PDF] computeProject failed:", e);
    }
  }
  
  if (!proj) {
    alert(T("err_project_unavailable"));
    return;
  }

  // KPI
  try {
    const payload = typeof kpiConfigSnapshot === "function" ? kpiConfigSnapshot(proj) : {};
    if (typeof KPI !== "undefined" && KPI?.sendNowait) {
      KPI.sendNowait("export_pdf_click", payload);
    }
  } catch {}

  // Vérifier les libs
  if (typeof window.html2canvas !== "function") {
    alert("Export PDF impossible : html2canvas non chargé.");
    return;
  }

  try {
    const blob = await buildPdfBlobProFromProject(proj);
    
    if (!blob || blob.size < 1000) {
      throw new Error("PDF blob invalide");
    }

    const projectSlug = (MODEL?.projectName || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9àâäéèêëïîôùûüç]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "projet";
    const filename = `${projectSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    console.log("[PDF] Export OK:", filename);
    
  } catch (e) {
    console.error("[PDF] Export failed:", e);
    alert("Export PDF échoué: " + e.message);
  }
}

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
}
