/**
 * utils-helpers.test.js — Tests pour utils/helpers.js
 */
import { describe, it, expect } from "vitest";
import { sanitizeFilename, dedupByUrl } from "../utils/helpers.js";

describe("sanitizeFilename", () => {
  it("remplace les caractères spéciaux par _", () => {
    expect(sanitizeFilename("mon/fichier?test")).toBe("mon_fichier_test");
  });
  it("normalise les espaces multiples", () => {
    expect(sanitizeFilename("mon   fichier")).toBe("mon fichier");
  });
  it("trim les espaces en début/fin", () => {
    expect(sanitizeFilename("  fichier  ")).toBe("fichier");
  });
  it('fallback sur "file" si vide', () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename(null)).toBe("file");
    expect(sanitizeFilename(undefined)).toBe("file");
  });
  it("laisse les noms normaux intacts", () => {
    expect(sanitizeFilename("projet-comelit_2024")).toBe("projet-comelit_2024");
  });
  it("gère les guillemets et deux-points", () => {
    expect(sanitizeFilename('config:"test"')).toBe("config__test_");
  });
});

describe("dedupByUrl", () => {
  it("retire les doublons par url", () => {
    const items = [
      { url: "http://a.com", name: "A" },
      { url: "http://b.com", name: "B" },
      { url: "http://a.com", name: "A2" },
    ];
    const result = dedupByUrl(items);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });
  it("ignore les items sans url", () => {
    const items = [
      { url: "", name: "vide" },
      { name: "sans url" },
      { url: "http://x.com", name: "X" },
    ];
    expect(dedupByUrl(items)).toHaveLength(1);
  });
  it("retourne [] si items est null/undefined", () => {
    expect(dedupByUrl(null)).toHaveLength(0);
    expect(dedupByUrl(undefined)).toHaveLength(0);
    expect(dedupByUrl([])).toHaveLength(0);
  });
  it("préserve l'ordre du premier élément unique", () => {
    const items = [
      { url: "http://c.com" },
      { url: "http://a.com" },
      { url: "http://b.com" },
      { url: "http://a.com" },
    ];
    expect(dedupByUrl(items).map(i => i.url)).toEqual([
      "http://c.com", "http://a.com", "http://b.com"
    ]);
  });
});
