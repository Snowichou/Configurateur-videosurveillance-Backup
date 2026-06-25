// ============================================================
// handlers/steps.js -- Handlers evenements (data-action)
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor -- PH2.20).
// Factory createStepsHandlers(deps) retourne :
//   { onStepsClick, onStepsChange, onStepsInput }
//
// updateAccessoryQty : reference dans onStepsChange mais non definie
//   dans la base de code (appel mort pre-existant -- conserve tel quel).
// confirmDialog : remplace window.confirm pour testabilite.
// ============================================================

export function createStepsHandlers(deps = {}) {
  const {
    MODEL,
    render,
    invalidateProjectCache,
    showToast,
    T,
    createEmptyCameraBlock,
    getCameraById,
    invalidateIfNeeded,
    loadConfigFromLocalStorage,
    rebuildAccessoryLinesFromBlocks,
    restoreFromSnapshot,
    sanity,
    suggestAccessories,
    unvalidateBlock,
    updateAccessoryQty,
    updateNavButtons,
    validateBlock,
    clampInt,
    SAVE_KEY,
    KPI,
    confirmDialog,
    openMeasureModal,
  } = deps;

function onStepsClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  // KPI safe helper (ne casse jamais l'app si KPI absent)
  const kpi = (event, payload = {}) => {
    try {
      const fn = (window.KPI && (KPI.send || KPI.sendNowait)) ? (KPI.send || KPI.sendNowait) : null;
      if (typeof fn === "function") fn(event, payload);
    } catch {}
  };

  if (action === "screenSize") {
    // Géré dans onStepsChange (c'est un select)
    return;
  }

  if (action === "measureDistance") {
    const bid = el.getAttribute("data-bid");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk) return;
    if (typeof openMeasureModal !== "function") return;
    openMeasureModal({
      heightM: (blk.answers && blk.answers.height_m) || "",
      T,
      onResult: ({ distanceM, heightM }) => {
        invalidateIfNeeded(blk);
        if (distanceM > 0) {
          blk.answers.distance_m = String(Math.min(999, Math.max(1, Math.round(distanceM))));
        }
        if (heightM > 0) blk.answers.height_m = String(heightM);
        MODEL.ui.activeBlockId = bid;
        render();
      },
    });
    return;
  }

  if (action === "resetNvr") {
    delete MODEL.overrideNvrId;
    invalidateProjectCache();
    render();
    if (typeof showToast === "function") showToast("✅ Sélection NVR automatique restaurée.", "ok");
    return;
  }

  if (action === "selectNvr") {
    const nvrId = el.dataset.nvrid;
    if (!nvrId) return;
    // Override le NVR sélectionné
    MODEL.overrideNvrId = nvrId;
    invalidateProjectCache();
    render();
    if (typeof showToast === "function") showToast("✅ NVR changé : " + nvrId, "ok");
    return;
  }

  if (action === "restoreSave") {
    const snap = loadConfigFromLocalStorage();
    if (snap && restoreFromSnapshot(snap)) {
      MODEL.stepIndex = 0; render();
      showToast("✅ Configuration restaurée !", "ok");
    } else showToast("❌ Impossible de restaurer.", "danger");
    return;
  }

  if (action === "deleteSave") {
    if (confirmDialog(T("err_save_fail"))) {
      localStorage.removeItem(SAVE_KEY); render();
      showToast("🗑️ " + T("msg_loaded"), "ok");
    }
    return;
  }

  if (action === "addBlock") {
    const nb = createEmptyCameraBlock();
    MODEL.cameraBlocks.push(nb);
    MODEL.ui.activeBlockId = nb.id;
    render();
    kpi("camera_block_add", { blockId: nb.id, blocksCount: MODEL.cameraBlocks.length });
    return;
  }

  if (action === "removeBlock") {
    const bid = el.getAttribute("data-bid");
    const idx = MODEL.cameraBlocks.findIndex((b) => b.id === bid);
    if (idx >= 0) {
      const blk = MODEL.cameraBlocks[idx];
      if (blk.validated) unvalidateBlock(blk);
      MODEL.cameraBlocks.splice(idx, 1);
      sanity();
      render();
      kpi("camera_block_remove", { blockId: bid, blocksCount: MODEL.cameraBlocks.length });
    }
    return;
  }

  if (action === "unvalidateBlock") {
    const bid = el.getAttribute("data-bid");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (blk) {
      unvalidateBlock(blk);
      render();
      kpi("camera_block_unvalidate", { blockId: bid });
    }
    return;
  }

  if (action === "uiToggleCompare") {
    const camId = el.getAttribute("data-camid");
    if (!camId) return;
    if (!Array.isArray(MODEL.ui.compare)) MODEL.ui.compare = [];
    const idx = MODEL.ui.compare.indexOf(camId);
    if (idx >= 0) {
      MODEL.ui.compare.splice(idx, 1);
    } else if (MODEL.ui.compare.length < 2) {
      MODEL.ui.compare.push(camId);
    } else {
      // Déjà 2 : remplace le plus ancien
      MODEL.ui.compare[0] = MODEL.ui.compare[1];
      MODEL.ui.compare[1] = camId;
    }
    render();
    return;
  }

  if (action === "uiClearCompare") {
    MODEL.ui.compare = [];
    render();
    return;
  }

  if (action === "validateCamera") {
    const camId = el.getAttribute("data-camid");
    const blk = MODEL.cameraBlocks.find((b) => b.id === MODEL.ui.activeBlockId);
    if (!blk) return;

    const cam = getCameraById(camId);
    if (!cam) return;

    validateBlock(blk, null, cam.id);
    render();

    kpi("camera_add_to_project", {
      blockId: blk.id,
      blockLabel: blk.label || "",
      cameraId: cam.id,
      cameraName: cam.name || "",
      qty: Number(blk.qty || 0) || 0,
    });

    return;
  }

  if (action === "recalcAccessories") {
    suggestAccessories();
    render();
    kpi("accessories_recalc", {});
    return;
  }

  if (action === "accDelete") {
    const bid = el.getAttribute("data-bid");
    const li = parseInt(el.getAttribute("data-li"), 10);
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk || !blk.accessories) return;
    blk.accessories.splice(li, 1);
    rebuildAccessoryLinesFromBlocks();
    render();
    kpi("accessory_remove", { blockId: bid, index: li });
    return;
  }

  if (action === "screenToggle") {
    MODEL.complements.screen.enabled = el.dataset.value === "1";
    invalidateProjectCache();
    render();
    kpi("complements_screen_toggle", { enabled: !!MODEL.complements.screen.enabled });
    return;
  }

  if (action === "enclosureToggle") {
    MODEL.complements.enclosure.enabled = el.dataset.value === "1";
    invalidateProjectCache();
    render();
    kpi("complements_enclosure_toggle", { enabled: !!MODEL.complements.enclosure.enabled });
    return;
  }

  if (action === "signageToggle") {
    MODEL.complements.signage =
      MODEL.complements.signage || { enabled: false, scope: "Public", qty: 1 };
    MODEL.complements.signage.enabled = el.dataset.value === "1";
    invalidateProjectCache();
    render();
    kpi("complements_signage_toggle", { enabled: !!MODEL.complements.signage.enabled });
    return;
  }

if (action === "projUseCase") {
  MODEL.projectUseCase = String(el.value || "").trim();
  
  // Propager aux blocs caméra existants qui n'ont pas de use_case
  (MODEL.cameraBlocks || []).forEach(blk => {
    if (blk.answers && !blk.answers.use_case) {
      blk.answers.use_case = MODEL.projectUseCase;
    }
  });
  
  // Mettre à jour l'UI sans re-render complet
  updateNavButtons();
  
  // Mettre à jour le message de statut
  const isComplete = MODEL.projectName?.trim() && MODEL.projectUseCase?.trim();
  const alertEl = document.querySelector(".stepSplit .alert");
  if (alertEl) {
    if (isComplete) {
      alertEl.className = "alert ok";
      alertEl.style.marginTop = "14px";
      alertEl.innerHTML = "✅ " + T("msg_info_complete");
    } else {
      alertEl.className = "alert warn";
      alertEl.style.marginTop = "14px";
      alertEl.innerHTML = "⚠️ " + T("proj_incomplete");
    }
  }
  
  // Mettre à jour la bordure du select
  el.style.borderColor = MODEL.projectUseCase?.trim() ? "var(--line)" : "rgba(220,38,38,.5)";
  
  return;
}

}

function onStepsChange(e) {
  // ✅ Toujours viser l’élément qui porte data-action (select/input)
  const el = e.target?.closest?.("[data-action]");
  if (!el) return;

  const action = el.getAttribute("data-action");
  if (!action) return;

  // Compléments — selects
  if (action === "screenSize") {
    const sz = Number(el.value);
    if (Number.isFinite(sz)) MODEL.complements.screen.sizeInch = sz;
    invalidateProjectCache();
    render();
    return;
  }

  // 1) Champs SELECT des blocs caméra

  if (action === "inputBlockLabel") {
  const bid = el.getAttribute("data-bid");
  const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
  if (!blk) return;

  blk.label = String(el.value ?? "").slice(0, 60);
  MODEL.ui.activeBlockId = bid;
  render(); // ✅ met à jour le titre du bloc
  return;
}
  if (action === "changeBlockField") {
    const bid = el.getAttribute("data-bid");
    const field = el.getAttribute("data-field");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk) return;

    invalidateIfNeeded(blk);
    blk.answers[field] = el.value;
    MODEL.ui.activeBlockId = bid;
    render();
    return;
  }

  if (action === "changeBlockQuality") {
    const bid = el.getAttribute("data-bid");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk) return;

    invalidateIfNeeded(blk);
    blk.quality = el.value;
    MODEL.ui.activeBlockId = bid;
    render();
    return;
  }

  // 2) COMMIT des inputs blocs caméra (fin de saisie)
  if (action === "inputBlockQty") {
  const bid = el.getAttribute("data-bid");
  const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
  if (!blk) return;

  invalidateIfNeeded(blk);

  // stock brut pendant saisie (digits uniquement)
  blk.qty = String(el.value ?? "").replace(/[^\d]/g, "");

  MODEL.ui.activeBlockId = bid;
  return; // pas de render pendant frappe
}


  if (action === "inputBlockField") {
    const bid = el.getAttribute("data-bid");
    const field = el.getAttribute("data-field");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk) return;

    invalidateIfNeeded(blk);

    if (field === "distance_m") {
      const v = String(el.value ?? "").trim();
      blk.answers[field] = v ? String(clampInt(v, 1, 999)) : "";
    } else if (field === "height_m") {
      const n = parseFloat(String(el.value ?? "").replace(",", "."));
      blk.answers[field] = Number.isFinite(n) ? String(Math.min(50, Math.max(0.1, n))) : "";
    } else {
      blk.answers[field] = el.value;
    }

    MODEL.ui.activeBlockId = bid;
    render();
    return;
  }

  // 3) Paramètres d’enregistrement (avec KPI)
  const isRecAction = [
    "recDays", "recHours", "recOver", "recReserve", "recFps", "recCodec", "recMode"
  ].includes(action);

  if (isRecAction) {
    MODEL.recording = MODEL.recording || {};

    if (action === "recDays")    MODEL.recording.daysRetention   = clampInt(el.value, 1, 365);
    if (action === "recHours")   MODEL.recording.hoursPerDay     = clampInt(el.value, 1, 24);
    if (action === "recOver")    MODEL.recording.overheadPct     = clampInt(el.value, 0, 100);
    if (action === "recReserve") MODEL.recording.reservePortsPct = clampInt(el.value, 0, 50);
    if (action === "recFps")     MODEL.recording.fps             = clampInt(el.value, 1, 60);
    if (action === "recCodec")   MODEL.recording.codec           = String(el.value || "");
    if (action === "recMode")    MODEL.recording.mode            = String(el.value || "");

    // ✅ KPI : 1 seul event propre (pas à chaque return)
    if (window.KPI?.sendNowait) {
      window.KPI.sendNowait("recording_change", {
        daysRetention: MODEL.recording.daysRetention,
        hoursPerDay: MODEL.recording.hoursPerDay,
        overheadPct: MODEL.recording.overheadPct,
        reservePortsPct: MODEL.recording.reservePortsPct,
        codec: MODEL.recording.codec,
        fps: MODEL.recording.fps,
        mode: MODEL.recording.mode
      });
    } else if (typeof window.kpi === "function") {
      window.kpi("recording_change", {
        daysRetention: MODEL.recording.daysRetention,
        hoursPerDay: MODEL.recording.hoursPerDay,
        overheadPct: MODEL.recording.overheadPct,
        reservePortsPct: MODEL.recording.reservePortsPct,
        codec: MODEL.recording.codec,
        fps: MODEL.recording.fps,
        mode: MODEL.recording.mode
      });
    }

    invalidateProjectCache();
    render();
    return;
  }

  // 4) Accessoires (qty)
  if (action === "accQty") {
    const aid = el.getAttribute("data-aid");
    const qty = clampInt(el.value, 0, 99);
    if (aid) updateAccessoryQty(aid, qty);
    render();
    return;
  }

      if (action === "screenQty") {
    MODEL.complements.screen.qty = clampInt(el.value, 1, 99);
    invalidateProjectCache();
    render();
    return;
  }
  if (action === "enclosureQty") {
    MODEL.complements.enclosure.qty = clampInt(el.value, 1, 99);
    invalidateProjectCache();
    render();
    return;
  }

  if (action === "signageScope") {
    MODEL.complements.signage = MODEL.complements.signage || { enabled: true, scope: "Public", qty: 1 };
    MODEL.complements.signage.scope = el.value || "Public";
    invalidateProjectCache();
    render();
    return;
  }

  if (action === "signageQty") {
    MODEL.complements.signage = MODEL.complements.signage || { enabled: true, scope: "Public", qty: 1 };
    MODEL.complements.signage.qty = clampInt(el.value, 1, 99);
    invalidateProjectCache();
    render();
    return;
  }

  // 6) Compléments (select)
  if (action === "compScreenSelect") {
    MODEL.complements.screen.selectedId = el.value || null;
    render();
    return;
  }
  if (action === "compEnclosureSelect") {
    MODEL.complements.enclosure.selectedId = el.value || null;
    render();
    return;
  }
    if (action === "compScreenQty") {
    MODEL.complements.screen.qty = clampInt(el.value, 1, 99);
    invalidateProjectCache();
    render();
    return;
  }
  if (action === "compEnclosureQty") {
    MODEL.complements.enclosure.qty = clampInt(el.value, 1, 99);
    invalidateProjectCache();
    render();
    return;
  }
}

function onStepsInput(e) {
  // ✅ Toujours viser l’élément qui porte data-action
  const el = e.target?.closest?.("[data-action]");
  if (!el) return;

  const action = el.getAttribute("data-action");
  if (!action) return;

  // ======================================================
  // 1) Label (nom du bloc) : PAS d'invalidation + pas render
  // ======================================================
  if (action === "inputBlockLabel") {
    const bid = el.getAttribute("data-bid");
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk) return;

    blk.label = String(el.value ?? "").slice(0, 60);
    MODEL.ui.activeBlockId = bid;
    return; // pas de render pendant frappe
  }

  // ======================================================
  // 2) Champs du bloc caméra (distance / etc.) : invalide + brut
  // ======================================================
  if (action === "inputBlockField") {
  const bid = el.getAttribute("data-bid");
  const field = el.getAttribute("data-field");
  const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
  if (!blk) return;

  const raw = el.value;

  // on invalide si on modifie un bloc déjà validé
  invalidateIfNeeded(blk);

  if (field === "distance_m") {
    blk.answers[field] = String(raw ?? "").replace(/[^\d]/g, "");
  } else {
    blk.answers[field] = raw;
  }

  MODEL.ui.activeBlockId = bid;
  return; // pas de render pendant frappe
}


  // ======================================================
  // 3) Quantité bloc : invalide + brut (digits)
  // ======================================================
  if (action === "inputBlockQty") {
  const bid = el.getAttribute("data-bid");
  const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
  if (!blk) return;

  invalidateIfNeeded(blk);

  // stock brut pendant saisie
  blk.qty = String(el.value ?? "").replace(/[^\d]/g, "");

  MODEL.ui.activeBlockId = bid;
  return; // pas de render pendant frappe
}


  // ======================================================
  // 4) Accessoires : qty live + rebuild
  // ======================================================
  if (action === "accQty") {
    const bid = el.getAttribute("data-bid");
    const li = parseInt(el.getAttribute("data-li"), 10);
    const blk = MODEL.cameraBlocks.find((b) => b.id === bid);
    if (!blk || !blk.accessories || !blk.accessories[li]) return;

    blk.accessories[li].qty = clampInt(el.value, 1, 999);
    rebuildAccessoryLinesFromBlocks();
    return;
  }

  // ======================================================
  // 5) Paramètres enregistrement : stock brut pendant saisie
  // ======================================================
  if (action === "recDays")    { MODEL.recording.daysRetention   = String(el.value ?? "").replace(/[^\d]/g, ""); return; }
  if (action === "recHours")   { MODEL.recording.hoursPerDay     = String(el.value ?? "").replace(/[^\d]/g, ""); return; }
  if (action === "recOver")    { MODEL.recording.overheadPct     = String(el.value ?? "").replace(/[^\d]/g, ""); return; }
  if (action === "recReserve") { MODEL.recording.reservePortsPct = String(el.value ?? "").replace(/[^\d]/g, ""); return; }

    // 6) Compléments (qty live)
  if (action === "compScreenQty") {
    MODEL.complements.screen.qty = String(el.value ?? "").replace(/[^\d]/g, "");
    return;
  }
  if (action === "compEnclosureQty") {
    MODEL.complements.enclosure.qty = String(el.value ?? "").replace(/[^\d]/g, "");
    return;
  }

  if (action === "projName") {
  // ⚠️ On stocke au fil de l'eau, mais on NE re-render pas l'écran
  // sinon l'input est recréé => perte de focus.
  MODEL.projectName = String(el.value || "").slice(0, 80);
  return;
}


}

  return { onStepsClick, onStepsChange, onStepsInput };
}

// -- Compat global --
if (typeof window !== 'undefined') {
}
