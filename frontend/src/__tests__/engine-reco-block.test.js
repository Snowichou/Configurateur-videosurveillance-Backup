/**
 * engine-reco-block.test.js — Tests pour engine/reco-block.js
 */
import { describe, it, expect, vi } from "vitest";
import { createRecoBlockHelpers } from "../engine/reco-block.js";

const toNum = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const MODEL = { projectUseCase: "Tertiaire" };
const recommendCameraForAnswers = vi.fn((ans) => ({ camId: "cam1", ans }));

const { canRecommendBlock, buildRecoForBlock } = createRecoBlockHelpers({
  MODEL,
  toNum,
  recommendCameraForAnswers,
});

describe("canRecommendBlock", () => {
  it("retourne true si toutes les réponses sont présentes", () => {
    expect(canRecommendBlock({
      answers: { emplacement: "exterieur", objective: "detection", distance_m: "10" }
    })).toBe(true);
  });
  it("retourne false si emplacement manquant", () => {
    expect(canRecommendBlock({
      answers: { objective: "detection", distance_m: "10" }
    })).toBe(false);
  });
  it("retourne false si objective manquant", () => {
    expect(canRecommendBlock({
      answers: { emplacement: "exterieur", distance_m: "10" }
    })).toBe(false);
  });
  it("retourne false si distance = 0", () => {
    expect(canRecommendBlock({
      answers: { emplacement: "exterieur", objective: "detection", distance_m: "0" }
    })).toBe(false);
  });
  it("retourne false si distance invalide", () => {
    expect(canRecommendBlock({
      answers: { emplacement: "exterieur", objective: "detection", distance_m: "abc" }
    })).toBe(false);
  });
  it("retourne false si blk est null", () => {
    expect(canRecommendBlock(null)).toBe(false);
  });
});

describe("buildRecoForBlock", () => {
  it("appelle recommendCameraForAnswers avec les bons paramètres", () => {
    recommendCameraForAnswers.mockClear();
    const blk = {
      answers: { emplacement: "interieur", objective: "identification", distance_m: "5", use_case: "Parking" }
    };
    const result = buildRecoForBlock(blk);
    expect(recommendCameraForAnswers).toHaveBeenCalledOnce();
    const call = recommendCameraForAnswers.mock.calls[0][0];
    expect(call.emplacement).toBe("interieur");
    expect(call.objective).toBe("identification");
    expect(call.distance_m).toBe(5);
    expect(call.use_case).toBe("Parking");
    expect(result).not.toBeNull();
  });
  it("utilise MODEL.projectUseCase si use_case manquant", () => {
    recommendCameraForAnswers.mockClear();
    const blk = {
      answers: { emplacement: "exterieur", objective: "detection", distance_m: "15" }
    };
    buildRecoForBlock(blk);
    expect(recommendCameraForAnswers.mock.calls[0][0].use_case).toBe("Tertiaire");
  });
  it("retourne null si canRecommendBlock est false", () => {
    expect(buildRecoForBlock({ answers: { emplacement: "exterieur" } })).toBeNull();
  });
});
