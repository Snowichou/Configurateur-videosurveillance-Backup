// utils/share.js
// ✅ Phase 3 — PH3.4 : generateQRDataUrl + generateShareUrl extraites depuis app.js
// generateQRDataUrl : DOM-dépendant, lib QRCode globale.
// generateShareUrl : retourne une URL de partage encodée.

export function generateQRDataUrlPure(text, size = 150) {
  // Pas de deps injectées — QRCode et document sont des globaux navigateur
  try {
    if (typeof QRCode === "undefined") {
      console.warn("[QR] QRCode lib not loaded");
      return "";
    }
    
    // Créer un container temporaire offscreen
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
    document.body.appendChild(div);
    
    // Générer le QR
    new QRCode(div, {
      text: text,
      width: size,
      height: size,
      colorDark: "#1C1F2A",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    
    // Récupérer le canvas
    const canvas = div.querySelector("canvas");
    let dataUrl = "";
    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    }
    
    // Cleanup
    div.remove();
    return dataUrl;
  } catch (e) {
    console.warn("[QR] Generation failed:", e);
    return "";
  }
}

export function generateShareUrlPure(deps = {}) {
  const { snapshotForSave, MODEL } = deps;
  try {
    const snap = typeof snapshotForSave === "function" ? snapshotForSave() : null;
    if (!snap && typeof MODEL !== "undefined") {
      // Fallback: construire un snapshot minimal
      const bl = (MODEL.cameraBlocks || []).map(b => ({
        id: b.id, lb: b.label, v: b.validated, sc: b.selectedCameraId, q: b.qty, a: b.answers
      }));
      const cl = (MODEL.cameraLines || []).map(l => ({
        ci: l.cameraId, fb: l.fromBlockId, q: l.qty
      }));
      const light = { pn: MODEL.projectName || "", uc: MODEL.projectUseCase || "", bl, cl };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(light))));
      if (encoded.length > 3500) return null; // Trop long pour QR
      const url = new URL(window.location.href);
      url.searchParams.set("cfg", encoded);
      return url.toString();
    }
    
    if (!snap) return null;
    const light = {
      pn: snap.projectName, uc: snap.projectUseCase,
      bl: (snap.cameraBlocks || []).map(b => ({ id: b.id, lb: b.label, v: b.validated, sc: b.selectedCameraId, q: b.qty, a: b.answers })),
      cl: (snap.cameraLines || []).map(l => ({ ci: l.cameraId, fb: l.fromBlockId, q: l.qty })),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(light))));
    if (encoded.length > 3500) return null;
    const url = new URL(window.location.href);
    url.searchParams.set("cfg", encoded);
    return url.toString();
  } catch (e) {
    console.warn("[Share] URL generation failed:", e);
    return null;
  }
}

// Compat shims pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
}
