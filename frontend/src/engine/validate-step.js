// engine/validate-step.js
// ✅ Phase 3 — PH3.3 : validateStep + showStepValidationErrors extraites depuis app.js
// validateStep est pure (retourne tableau d'erreurs) ;
// showStepValidationErrors utilise document (DOM implicite).

export function validateStepPure(stepId, deps = {}) {
  const { MODEL, T, getProjectCached } = deps;
  const errors = [];
  
  switch (stepId) {
    case "project":
      if (!MODEL.projectName?.trim()) errors.push(T("err_project_name_required"));
      if (!MODEL.projectUseCase?.trim()) errors.push(T("err_site_type_required"));
      break;
      
    case "cameras": {
      const validatedCount = (MODEL.cameraBlocks || []).filter(b => b.validated).length;
      if (validatedCount === 0) errors.push(T("err_validate_one_camera"));
      // Vérifier que tous les blocs actifs ont des réponses complètes
      for (const blk of (MODEL.cameraBlocks || [])) {
        if (blk.validated) continue; // validé = OK
        const ans = blk.answers || {};
        if (ans.emplacement || ans.objective || ans.distance) {
          // Bloc partiellement rempli mais non validé
          errors.push(`Le bloc "${blk.label || 'sans nom'}" est en cours — validez-le ou supprimez-le.`);
        }
      }
      break;
    }
      
    case "mounts":
      // Pas de validation stricte pour les accessoires
      break;
      
    case "nvr_network": {
      try {
        const proj = getProjectCached();
        if (!proj?.nvrPick?.nvr) {
          errors.push("Aucun NVR compatible trouvé. Vérifiez le catalogue NVR.");
        }
      } catch {
        errors.push("Impossible de calculer la configuration NVR.");
      }
      break;
    }
      
    case "storage": {
      const rec = MODEL.recording;
      if (!rec.daysRetention || rec.daysRetention < 1) errors.push(T("pdf_days_retention") + " invalides (min. 1).");
      if (rec.daysRetention > 30) errors.push("La loi limite la conservation à 30 jours maximum.");
      if (!rec.hoursPerDay || rec.hoursPerDay < 1) errors.push("Heures/jour invalides (min. 1).");
      break;
    }
  }
  
  return errors;
}

export function showStepValidationErrorsPure(errors, deps = {}) {
  const { T } = deps;
  if (!errors.length) return;
  
  // Supprimer un ancien toast s'il existe
  const old = document.getElementById("stepValidationToast");
  if (old) old.remove();
  
  const toast = document.createElement("div");
  toast.id = "stepValidationToast";
  Object.assign(toast.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    zIndex: "99998", maxWidth: "500px", width: "90%",
    background: "#1C1F2A", color: "#fff", borderRadius: "14px",
    padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    borderLeft: "4px solid #DC2626",
    animation: "slideUpToast .3s ease",
  });
  
  toast.innerHTML = `
    <div style="font-weight:900;font-size:14px;margin-bottom:8px">${"⚠️ " + T("err_cannot_continue")}</div>
    ${errors.map(e => `<div style="font-size:13px;margin-top:4px;opacity:0.9">• ${e}</div>`).join("")}
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove après 5s
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  // Click to dismiss
  toast.addEventListener("click", () => toast.remove());
}

// Compat shims pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
}
