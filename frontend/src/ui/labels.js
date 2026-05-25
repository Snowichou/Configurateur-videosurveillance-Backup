/**
 * ui/labels.js — Helpers labels / traduction UI
 * PH5.2b — extrait de app.js
 *
 * Exports:
 *   createLabelsHelpers(deps) — factory
 *     deps: { T, CATALOG }
 *     returns: { objectiveLabel, accessoryTypeLabel, translateUseCase,
 *                getAllUseCases, getCameraProfile }
 */

/** Profils caméra par use-case + emplacement (données statiques) */
const CAMERA_PROFILES = {
  "Tertiaire|interieur": {
    preferred: ["turret", "dome", "fish-eye"],
    penalized: ["ptz", "lpr"],
    ptzMinDistance: 50,
  },
  "Tertiaire|exterieur": {
    preferred: ["bullet", "dome"],
    penalized: ["fish-eye", "lpr"],
    ptzMinDistance: 35,
  },
  "Résidentiel|interieur": {
    preferred: ["turret", "dome"],
    penalized: ["ptz", "bullet", "lpr"],
    ptzMinDistance: 999,
  },
  "Résidentiel|exterieur": {
    preferred: ["bullet", "turret"],
    penalized: ["ptz", "lpr", "fish-eye"],
    ptzMinDistance: 60,
  },
  "Logement collectif|interieur": {
    preferred: ["dome"],
    penalized: ["ptz", "bullet", "lpr", "turret"],
    ptzMinDistance: 999,
  },
  "Logement collectif|exterieur": {
    preferred: ["bullet", "dome"],
    penalized: ["lpr", "fish-eye", "turret"],
    ptzMinDistance: 35,
  },
  "Parking|interieur": {
    preferred: ["dome"],
    penalized: ["turret", "ptz", "bullet", "fish-eye"],
    ptzMinDistance: 999,
  },
  "Parking|exterieur": {
    preferred: ["dome", "bullet", "lpr"],
    penalized: ["turret", "fish-eye"],
    ptzMinDistance: 40,
  },
};

/** Micro-helper pur : valeur "fausse" au sens métier */
function isFalseLike(v) {
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "false" || s === "0" || s === "no" || s === "n";
}

export function createLabelsHelpers(deps = {}) {
  const { T, CATALOG } = deps;

  function objectiveLabel(obj) {
    const labels = {
      detection: T("cam_detection").split("(")[0].trim(),
      observation: T("cam_observation").split("(")[0].trim(),
      reconnaissance: T("cam_recognition").split("(")[0].trim(),
      identification: T("cam_identification").split("(")[0].trim(),
      dissuasion: T("cam_observation").split("(")[0].trim(),
    };
    return labels[obj] || T("cam_identification").split("(")[0].trim();
  }

  function accessoryTypeLabel(t) {
    return ({
      junction_box: T("mount_junction"),
      wall_mount: T("mount_bracket"),
      ceiling_mount: T("cam_ceiling") + " " + T("mount_bracket").toLowerCase(),
    }[t] || t);
  }

  function translateUseCase(uc) {
    const map = {
      "Résidentiel": T("uc_residential"),
      "Tertiaire": T("uc_tertiary"),
      "Logement collectif": T("uc_collective"),
      "Intrusion humaine": T("uc_intrusion"),
      "Intrusion humaine + Dissuasion active": T("uc_intrusion_active"),
    };
    return map[uc] || uc;
  }

  function getAllUseCases() {
    const set = new Set();
    for (const c of CATALOG.CAMERAS) {
      for (const u of (c.use_cases || [])) {
        if (!isFalseLike(u)) set.add(String(u).trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function getCameraProfile(useCase, emplacement) {
    const key = `${useCase}|${emplacement}`;
    if (CAMERA_PROFILES[key]) return CAMERA_PROFILES[key];
    if (emplacement === "interieur") return { preferred: ["turret","dome"], penalized: ["ptz","lpr"], ptzMinDistance: 50 };
    if (emplacement === "exterieur") return { preferred: ["bullet","dome","turret"], penalized: [], ptzMinDistance: 40 };
    return { preferred: [], penalized: [], ptzMinDistance: 40 };
  }

  return { objectiveLabel, accessoryTypeLabel, translateUseCase, getAllUseCases, getCameraProfile };
}

window._createLabelsHelpers = createLabelsHelpers;
