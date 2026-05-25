/**
 * ui-labels.test.js — Tests pour ui/labels.js
 */
import { describe, it, expect } from "vitest";
import { createLabelsHelpers } from "../ui/labels.js";

// Mock T() : retourne la clé entre crochets
const T = (k) => `[${k}]`;

// CATALOG minimal
const CATALOG = {
  CAMERAS: [
    { use_cases: ["Résidentiel", "Tertiaire"] },
    { use_cases: ["Parking", "false", "", null] },
    { use_cases: ["Résidentiel", "Logement collectif"] },
  ],
};

const {
  objectiveLabel,
  accessoryTypeLabel,
  translateUseCase,
  getAllUseCases,
  getCameraProfile,
} = createLabelsHelpers({ T, CATALOG });

describe("objectiveLabel", () => {
  it("retourne le label traduit pour detection", () => {
    expect(objectiveLabel("detection")).toBe("[cam_detection]");
  });
  it("retourne le label traduit pour observation", () => {
    expect(objectiveLabel("observation")).toBe("[cam_observation]");
  });
  it("retourne identification par défaut pour clé inconnue", () => {
    expect(objectiveLabel("inconnu")).toBe("[cam_identification]");
  });
  it("gère dissuasion (alias observation)", () => {
    expect(objectiveLabel("dissuasion")).toBe("[cam_observation]");
  });
});

describe("accessoryTypeLabel", () => {
  it("junction_box traduit", () => {
    expect(accessoryTypeLabel("junction_box")).toBe("[mount_junction]");
  });
  it("wall_mount traduit", () => {
    expect(accessoryTypeLabel("wall_mount")).toBe("[mount_bracket]");
  });
  it("ceiling_mount traduit (concat)", () => {
    expect(accessoryTypeLabel("ceiling_mount")).toBe("[cam_ceiling] [mount_bracket]");
  });
  it("type inconnu retourné tel quel", () => {
    expect(accessoryTypeLabel("foo_bar")).toBe("foo_bar");
  });
});

describe("translateUseCase", () => {
  it("traduit Résidentiel", () => {
    expect(translateUseCase("Résidentiel")).toBe("[uc_residential]");
  });
  it("traduit Tertiaire", () => {
    expect(translateUseCase("Tertiaire")).toBe("[uc_tertiary]");
  });
  it("traduit Logement collectif", () => {
    expect(translateUseCase("Logement collectif")).toBe("[uc_collective]");
  });
  it("retourne la valeur originale pour use-case inconnu", () => {
    expect(translateUseCase("Autre")).toBe("Autre");
  });
});

describe("getAllUseCases", () => {
  it("retourne une liste triée de use-cases uniques", () => {
    const ucs = getAllUseCases();
    expect(ucs).toContain("Résidentiel");
    expect(ucs).toContain("Tertiaire");
    expect(ucs).toContain("Parking");
    expect(ucs).toContain("Logement collectif");
    // pas de doublons
    expect(new Set(ucs).size).toBe(ucs.length);
  });
  it("filtre les valeurs fausses (false, vide, null)", () => {
    const ucs = getAllUseCases();
    expect(ucs).not.toContain("false");
    expect(ucs).not.toContain("");
    expect(ucs).not.toContain(null);
  });
  it("liste triée alphabétiquement (fr)", () => {
    const ucs = getAllUseCases();
    const sorted = [...ucs].sort((a, b) => a.localeCompare(b, "fr"));
    expect(ucs).toEqual(sorted);
  });
});

describe("getCameraProfile", () => {
  it("retourne le profil Tertiaire|interieur", () => {
    const p = getCameraProfile("Tertiaire", "interieur");
    expect(p.preferred).toContain("turret");
    expect(p.ptzMinDistance).toBe(50);
  });
  it("retourne le profil Parking|exterieur", () => {
    const p = getCameraProfile("Parking", "exterieur");
    expect(p.preferred).toContain("lpr");
  });
  it("fallback interieur pour use-case inconnu", () => {
    const p = getCameraProfile("Inconnu", "interieur");
    expect(p.preferred).toContain("dome");
    expect(p.ptzMinDistance).toBe(50);
  });
  it("fallback exterieur pour use-case inconnu", () => {
    const p = getCameraProfile("Inconnu", "exterieur");
    expect(p.preferred).toContain("bullet");
    expect(p.ptzMinDistance).toBe(40);
  });
  it("fallback générique pour emplacement inconnu", () => {
    const p = getCameraProfile("Inconnu", "inconnu");
    expect(p.preferred).toEqual([]);
    expect(p.ptzMinDistance).toBe(40);
  });
});
