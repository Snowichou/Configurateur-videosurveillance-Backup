/**
 * engine/complements.js — Recommandation / sélection des compléments
 * (écran, boîtier, signalétique)
 * PH5.1 — extrait de app.js
 *
 * Exports (factory):
 *   createComplementsHandlers(deps) => {
 *     pickScreenBySize, isScreenInsideCompatible, pickBestEnclosure,
 *     getSignages, pickSignageByScope, getSelectedOrRecommendedSign,
 *     recommendScreenForProject, recommendEnclosureForNvr,
 *     getSelectedOrRecommendedScreen, recommendEnclosureForProject,
 *     getSelectedOrRecommendedEnclosure
 *   }
 *
 * deps: { MODEL, CATALOG }
 */

const SCREEN_INSIDE_ONLY_ID = 'MMON185A';

const safeStr = (v) => (v ?? '').toString().trim();

export function createComplementsHandlers(deps = {}) {
  const { MODEL, CATALOG } = deps;

  // ── Écrans ────────────────────────────────────────────────

  function pickScreenBySize(sizeInch) {
    const screens = CATALOG.SCREENS || [];
    if (!screens.length) return null;

    let exact = screens.find(s => Number(s.size_inch) === Number(sizeInch));
    if (exact) return exact;

    let best = null, bestDelta = Infinity;
    for (const s of screens) {
      const v = Number(s.size_inch);
      if (!Number.isFinite(v)) continue;
      const d = Math.abs(v - Number(sizeInch));
      if (d < bestDelta) { bestDelta = d; best = s; }
    }
    return best || screens[0] || null;
  }

  function isScreenInsideCompatible(enclosure, screen) {
    if (!enclosure || !screen) return false;
    if (Array.isArray(enclosure.screen_compatible_with) && enclosure.screen_compatible_with.length) {
      return enclosure.screen_compatible_with.includes(screen.id);
    }
    return screen.id === SCREEN_INSIDE_ONLY_ID;
  }

  // ── Boîtiers ─────────────────────────────────────────────

  function pickBestEnclosure(proj, screen) {
    const encs = CATALOG.ENCLOSURES || [];
    const nvrId = proj?.nvrPick?.nvr?.id || null;
    if (!encs.length || !nvrId) {
      return { enclosure: null, reason: 'no_nvr_or_catalog', screenInsideOk: false };
    }

    const encNvrCompatible = encs.filter(e =>
      Array.isArray(e.compatible_with) && e.compatible_with.includes(nvrId)
    );

    if (!encNvrCompatible.length) {
      return { enclosure: null, reason: 'no_enclosure_for_nvr', screenInsideOk: false };
    }

    if (screen) {
      const encBoth = encNvrCompatible.find(e => isScreenInsideCompatible(e, screen));
      if (encBoth) return { enclosure: encBoth, reason: 'nvr_and_screen_ok', screenInsideOk: true };
      return { enclosure: encNvrCompatible[0], reason: 'nvr_ok_screen_not_inside', screenInsideOk: false };
    }

    return { enclosure: encNvrCompatible[0], reason: 'nvr_ok_no_screen', screenInsideOk: false };
  }

  // ── Signalétique ─────────────────────────────────────────

  function getSignages() {
    return Array.isArray(CATALOG.SIGNAGE) ? CATALOG.SIGNAGE : [];
  }

  function pickSignageByScope(scope) {
    const wanted = safeStr(scope || 'Public').toLowerCase();
    const signs = getSignages();

    let hit = signs.find((s) => safeStr(s.scope).toLowerCase() === wanted);
    if (hit) return hit;

    if (wanted.includes('priv')) {
      hit = signs.find((s) => safeStr(s.scope).toLowerCase().includes('public'));
      if (hit) return hit;
    } else {
      hit = signs.find((s) => safeStr(s.scope).toLowerCase().includes('priv'));
      if (hit) return hit;
    }

    return signs[0] || null;
  }

  function getSelectedOrRecommendedSign() {
    const enabled = !!MODEL.complements?.signage?.enabled;
    if (!enabled) return { sign: null, reason: 'disabled' };

    const scope = MODEL.complements.signage.scope || 'Public';
    const sign = pickSignageByScope(scope);
    if (!sign) return { sign: null, reason: 'no_catalog' };
    return { sign, reason: 'scope_match' };
  }

  // ── Recommandations écran / boîtier ───────────────────────

  function recommendScreenForProject(totalCameras) {
    const screens = CATALOG.SCREENS || [];
    if (!screens.length) return null;

    const target =
      totalCameras <= 8  ? 24 :
      totalCameras <= 16 ? 32 :
      totalCameras <= 32 ? 43 : 55;

    let best = null, bestDelta = Infinity;
    for (const s of screens) {
      const size = Number(s.size_inch);
      if (!Number.isFinite(size)) continue;
      const d = Math.abs(size - target);
      if (d < bestDelta) { bestDelta = d; best = s; }
    }
    return best || screens[0] || null;
  }

  function recommendEnclosureForNvr(nvrId) {
    const encs = CATALOG.ENCLOSURES || [];
    if (!encs.length || !nvrId) return null;
    const found = encs.find(e => Array.isArray(e.compatible_with) && e.compatible_with.includes(nvrId));
    return found || null;
  }

  function getSelectedOrRecommendedScreen(proj) {
    const screens = CATALOG.SCREENS || [];
    if (!screens.length) return { selected: null, recommended: null };

    const selected = MODEL.complements.screen.enabled
      ? pickScreenBySize(MODEL.complements.screen.sizeInch)
      : null;

    const recommended = recommendScreenForProject(proj.totalCameras) || null;
    return { selected: selected || null, recommended };
  }

  function recommendEnclosureForProject(proj) {
    const nvrId = proj?.nvrPick?.nvr?.id || null;
    if (!nvrId) return null;
    return recommendEnclosureForNvr(nvrId);
  }

  function getSelectedOrRecommendedEnclosure(proj) {
    const encs = CATALOG.ENCLOSURES || [];
    if (!encs.length) return { selected: null, recommended: null };

    if (MODEL.complements.enclosure.enabled) {
      const screenSel = MODEL.complements.screen.enabled
        ? pickScreenBySize(MODEL.complements.screen.sizeInch)
        : null;

      const enclosureAuto = pickBestEnclosure(proj, screenSel);
      return { selected: enclosureAuto.enclosure || null, recommended: recommendEnclosureForProject(proj) };
    }

    return { selected: null, recommended: recommendEnclosureForProject(proj) };
  }

  return {
    pickScreenBySize, isScreenInsideCompatible, pickBestEnclosure,
    getSignages, pickSignageByScope, getSelectedOrRecommendedSign,
    recommendScreenForProject, recommendEnclosureForNvr,
    getSelectedOrRecommendedScreen, recommendEnclosureForProject,
    getSelectedOrRecommendedEnclosure,
  };
}

