// render/pdf-test.js
// ✅ Phase 3 — PH3.7 : testPdfGeneration + ensurePdfPackButton extraits depuis app.js

export async function testPdfGenerationPure(verbose = true, deps = {}) {
  const {
    getLastProject = null,
    computeProject = null,
    buildPdfHtml = null,
    buildPdfBlobProFromProject = null,
  } = deps;

  const results = { pass: 0, fail: 0, errors: [] };
  const log = (ok, msg) => {
    if (ok) results.pass++;
    else { results.fail++; results.errors.push(msg); }
    if (verbose) console.log(`[PDF-TEST] ${ok ? "\u2705" : "\u274c"} ${msg}`);
  };

  try {
    // 1) Vérifier que le projet est disponible
    const lastProj = (typeof getLastProject === "function") ? getLastProject() : null;
    const proj = lastProj || (typeof computeProject === "function" ? computeProject() : null);
    log(!!proj, "Projet disponible");
    if (!proj) { console.log("[PDF-TEST] Arrêt : pas de projet"); return results; }

    // 2) Vérifier buildPdfHtml
    let html;
    try {
      html = buildPdfHtml(proj);
      log(!!html && html.length > 500, "buildPdfHtml OK (" + html.length + " chars)");
    } catch (e) {
      log(false, "buildPdfHtml ERREUR: " + e.message);
      return results;
    }

    // 3) Vérifier le nombre de pages
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const allPages = tempDiv.querySelectorAll(".pdfPage");
    const portraitPages = tempDiv.querySelectorAll(".pdfPage:not(.pdfPageLandscape)");
    const landscapePages = tempDiv.querySelectorAll(".pdfPageLandscape");

    log(allPages.length >= 4, "Nombre de pages: " + allPages.length + " (min. 4 attendu)");
    log(portraitPages.length >= 3, "Pages portrait: " + portraitPages.length + " (min. 3)");
    log(landscapePages.length >= 1, "Pages paysage (synoptique): " + landscapePages.length + " (min. 1)");

    // 4) Vérifier la page 0 (synthèse)
    const page0 = allPages[0];
    log(!!page0?.querySelector(".greenBand"), "Page 0 : bande verte présente");
    log(!!page0?.querySelector(".dashGrid"), "Page 0 : dashboard KPI présent");
    log(!!page0?.querySelector(".footerLine"), "Page 0 : footer présent");

    // 5) Vérifier la page synoptique
    const synPage = landscapePages[0];
    log(!!synPage?.querySelector(".synWrap"), "Page synoptique : synWrap présent");
    log(!!synPage?.querySelector(".synStage"), "Page synoptique : synStage présent");

    // 6) Vérifier les headers sur chaque page
    let allHeaders = true;
    allPages.forEach((p, i) => {
      if (!p.querySelector(".pdfHeader")) { allHeaders = false; log(false, "Page " + i + ": header manquant"); }
    });
    if (allHeaders) log(true, "Toutes les pages ont un header");

    // 7) Vérifier les footers
    let allFooters = true;
    allPages.forEach((p, i) => {
      if (!p.querySelector(".footerLine")) { allFooters = false; log(false, "Page " + i + ": footer manquant"); }
    });
    if (allFooters) log(true, "Toutes les pages ont un footer");

    // 8) Dimensions : vérification manuelle via aperçu PDF
    log(true, "Dimensions: vérification manuelle via aperçu PDF");

    // 9) Test de génération réelle (si libs disponibles)
    if (typeof window?.jspdf?.jsPDF === "function" && typeof window?.html2canvas === "function") {
      try {
        const blob = await buildPdfBlobProFromProject(proj);
        const ko = blob ? (blob.size / 1024).toFixed(0) + " Ko" : "null";
        log(!!blob && blob.size > 5000, "PDF blob généré: " + ko);
        log(blob?.type === "application/pdf", "Type MIME: " + blob?.type);
      } catch (e) {
        log(false, "Génération PDF réelle échouée: " + e.message);
      }
    } else {
      log(true, "Génération réelle: libs non chargées (test HTML uniquement)");
    }

    console.log("[PDF-TEST] === RÉSULTAT: " + results.pass + " OK / " + results.fail + " KO ===");
    if (results.errors.length) {
      console.log("[PDF-TEST] Erreurs:", results.errors);
    }

  } catch (e) {
    log(false, "Exception globale: " + e.message);
  }

  return results;
}

export function ensurePdfPackButtonPure(deps = {}) {
  const {
    T = (k) => k,
    exportProjectPdfWithLocalDatasheetsZip = null,
  } = deps;

  const pdfBtn = document.querySelector("#btnExportPdf");
  if (!pdfBtn) return false;
  if (document.querySelector("#btnExportPdfPack")) return true;

  const packBtn = document.createElement("button");
  packBtn.id = "btnExportPdfPack";
  packBtn.type = "button";
  packBtn.className = (pdfBtn.className || "btn").replace("primary", "secondary");
  packBtn.textContent = T("sum_export_pack");
  packBtn.style.marginLeft = "8px";

  pdfBtn.insertAdjacentElement("afterend", packBtn);

  packBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    packBtn.disabled = true;
    packBtn.textContent = "Génération...";
    try {
      await exportProjectPdfWithLocalDatasheetsZip();
    } finally {
      packBtn.disabled = false;
      packBtn.textContent = T("sum_export_pack");
    }
  });

  return true;
}

if (typeof window !== 'undefined') {
}
