// render/pdf-export.js
// ✅ Phase 2 — PH2.24 : exportProjectPdfWithLocalDatasheetsZip extraite depuis app.js
// Module ESM — dépendances injectées via deps ;
// les globaux navigateur (document, window, fetch, JSZip) restent implicites.

export async function exportProjectPdfWithLocalDatasheetsZipPure(deps = {}) {
  const {
    T,
    getLastProject,
    setLastProject,
    computeProject,
    buildPdfBlobProFromProject,
    collectDatasheetUrlsFromProject,
    MODEL,
  } = deps;
  // Récupérer le projet
  let proj = (typeof getLastProject === "function" ? getLastProject() : null);
    
  if (!proj && typeof computeProject === "function") {
    try {
      proj = computeProject();
      if (typeof setLastProject === "function") { setLastProject(proj); }
    } catch (e) {
      console.error("[ZIP] computeProject failed:", e);
    }
  }

  if (!proj) {
    alert(T("err_project_unavailable"));
    return;
  }

  const day = new Date().toISOString().slice(0, 10);

  // Générer le PDF
  let pdfBlob;
  try {
    pdfBlob = await buildPdfBlobProFromProject(proj);
    if (!pdfBlob || pdfBlob.size < 5000) {
      throw new Error("PDF invalide");
    }
  } catch (e) {
    console.error("[ZIP] PDF error:", e);
    alert("Impossible de générer le PDF: " + e.message);
    return;
  }

  // Convertir PDF en base64
  const pdf_base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(pdfBlob);
  });

  // Collecter les URLs de fiches techniques (localisées selon la langue)
  const datasheet_items = collectDatasheetUrlsFromProject(proj);

  const projectSlugZip = (MODEL?.projectName || "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40) || "projet";

  const zipName = `${projectSlugZip}_${day}.zip`;

  // ======== BUILD ZIP CLIENT-SIDE via proxy PDF ========
  
  // Créer la barre de progression
  let progressOverlay = document.getElementById("zipProgressOverlay");
  if (!progressOverlay) {
    progressOverlay = document.createElement("div");
    progressOverlay.id = "zipProgressOverlay";
    progressOverlay.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999">
        <div style="background:#fff;border-radius:16px;padding:28px 32px;min-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center">
          <div style="font-size:24px;margin-bottom:8px">📦</div>
          <div id="zipProgressTitle" style="font-weight:800;font-size:15px;color:#1C1F2A;margin-bottom:4px">${T("sum_export_pack")}</div>
          <div id="zipProgressStatus" style="font-size:12px;color:#64748b;margin-bottom:14px">...</div>
          <div style="width:100%;height:8px;border-radius:4px;background:#e5e7eb;overflow:hidden">
            <div id="zipProgressBar" style="width:0%;height:100%;border-radius:4px;background:linear-gradient(90deg,#00BC70,#00a863);transition:width .3s ease"></div>
          </div>
          <div id="zipProgressPct" style="font-size:11px;color:#94a3b8;margin-top:6px">0%</div>
        </div>
      </div>`;
    document.body.appendChild(progressOverlay);
  }
  progressOverlay.style.display = "block";

  const setProgress = (pct, status) => {
    const bar = document.getElementById("zipProgressBar");
    const pctEl = document.getElementById("zipProgressPct");
    const statusEl = document.getElementById("zipProgressStatus");
    if (bar) bar.style.width = pct + "%";
    if (pctEl) pctEl.textContent = Math.round(pct) + "%";
    if (statusEl) statusEl.textContent = status;
  };

  setProgress(5, "PDF...");
  
  try {
    // Charger JSZip
    if (typeof JSZip === "undefined") {
      setProgress(8, "Loading JSZip...");
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("JSZip load failed"));
        document.head.appendChild(s);
      });
    }

    const zip = new JSZip();

    // 1) PDF principal
    const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
    zip.file(`${projectSlugZip}_${day}.pdf`, pdfBytes);
    setProgress(15, `PDF ✅ (${(pdfBytes.length / 1024).toFixed(0)} KB)`);
    console.log(`[ZIP] ✅ PDF (${(pdfBytes.length / 1024).toFixed(0)} KB)`);

    // 2) Fiches techniques via proxy (avec fallback FR si la langue cible n'existe pas)
    let fetchedCount = 0;
    const failedLinks = [];
    const total = datasheet_items.length;

    const fetchPdf = async (item, idx) => {
      // URL localisée (ex: /de_DE/)
      const localizedUrl = item.url;
      // URL fallback FR (remplacer la locale par fr_FR)
      const frUrl = localizedUrl
        .replace(/\/(en_GB|it_IT|es_ES|de_DE)\//g, "/fr_FR/")
        .replace(/\/(en-gb|it-it|es-es|de-de)\//g, "/fr-fr/");
      
      const urlsToTry = [localizedUrl];
      if (frUrl !== localizedUrl) urlsToTry.push(frUrl);

      for (const url of urlsToTry) {
        try {
          const proxyUrl = `/proxy-pdf?url=${encodeURIComponent(url)}`;
          const resp = await fetch(proxyUrl);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          if (blob.size > 2000) {
            const header = await blob.slice(0, 5).text();
            if (header.startsWith("%PDF")) {
              zip.file(item.path, blob);
              fetchedCount++;
              const lang = url === localizedUrl ? "" : " (FR)";
              console.log(`[ZIP] ✅ ${item.path}${lang} (${(blob.size / 1024).toFixed(0)} KB)`);
              return;
            }
          }
        } catch { /* try next */ }
      }
      console.warn(`[ZIP] ❌ ${item.path}`);
      failedLinks.push(localizedUrl);
    };

    // Télécharger par batch de 4 avec progression
    for (let i = 0; i < total; i += 4) {
      const batch = datasheet_items.slice(i, i + 4);
      await Promise.allSettled(batch.map((item, j) => fetchPdf(item, i + j)));
      const done = Math.min(i + 4, total);
      const pct = 15 + (done / total) * 70;
      setProgress(pct, `${T("btn_datasheet")} ${done}/${total}...`);
    }

    // 3) Fichier liens pour les échouées
    if (failedLinks.length > 0) {
      zip.file("datasheets_links.txt",
        "DATASHEETS\n" + "=".repeat(50) + "\n\n"
        + failedLinks.map((u, i) => `${i + 1}. ${u}`).join("\n"));
    }

    console.log(`[ZIP] Result: ${fetchedCount}/${total} datasheets`);
    setProgress(90, "ZIP...");

    // 4) Générer le ZIP
    const finalZip = await zip.generateAsync({ type: "blob" });
    setProgress(98, `${(finalZip.size / 1024).toFixed(0)} KB`);

    const dlUrl = URL.createObjectURL(finalZip);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(dlUrl), 2000);

    console.log(`[ZIP] ✅ Export: ${(finalZip.size / 1024).toFixed(0)} KB, ${fetchedCount}/${total} datasheets`);
    setProgress(100, `✅ ${fetchedCount}/${total} ${T("btn_datasheet")}`);
    
    setTimeout(() => { if (progressOverlay) progressOverlay.style.display = "none"; }, 1500);

  } catch (err) {
    console.error("[ZIP] Error:", err);
    if (progressOverlay) progressOverlay.style.display = "none";
    alert("Export: " + err.message);
  }
}

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
  window._exportProjectPdfWithLocalDatasheetsZipPure = exportProjectPdfWithLocalDatasheetsZipPure;
}
