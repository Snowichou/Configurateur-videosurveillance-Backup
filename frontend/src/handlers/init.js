// handlers/init.js
// ✅ Phase 4 — PH4.2 : init (bootstrap app) extrait depuis app.js
// Charge les CSV, peuple CATALOG, déclenche le premier render.

export async function initPure(deps = {}) {
  const {
    DOM = {},
    KPI = { sendNowait: () => {} },
    loadCsv = null,
    CATALOG = {},
    MODEL = {},
    setLastProject = null,
    normalizeCamera = (x) => x,
    normalizeNvr = (x) => x,
    normalizeHdd = (x) => x,
    normalizeSwitch = (x) => x,
    normalizeScreen = (x) => x,
    normalizeEnclosure = (x) => x,
    normalizeSignageRow = (x) => x,
    normalizeAccessoryMapping = (x) => x,
    applyLocalMediaToCatalog = null,
    sanity = null,
    syncResultsUI = null,
    render = null,
    updateNavButtons = null,
  } = deps;

  try {
    if (DOM.dataStatusEl) DOM.dataStatusEl.textContent = "Chargement des données\u2026";
    KPI.sendNowait('page_view', { app: 'configurateur', v: (window.APP_VERSION || null) });

    const loadCsvSafe = async (name, required = false) => {
      try {
        return await loadCsv(`/data/${name}.csv`);
      } catch (e) {
        if (required) throw e;
        return [];
      }
    };

    const [
      camsRaw,
      nvrsRaw,
      hddsRaw,
      swRaw,
      accRaw,
      screensRaw,
      enclosuresRaw,
      signageRaw,
    ] = await Promise.all([
      loadCsvSafe("cameras", true),
      loadCsvSafe("nvrs", true),
      loadCsvSafe("hdds", true),
      loadCsvSafe("switches", true),
      loadCsvSafe("accessories", true),
      loadCsvSafe("screens"),
      loadCsvSafe("enclosures"),
      loadCsvSafe("signage"),
    ]);

    CATALOG.CAMERAS = camsRaw.map(normalizeCamera).filter((c) => c.id);
    CATALOG.NVRS = nvrsRaw.map(normalizeNvr).filter((n) => n.id);
    CATALOG.HDDS = hddsRaw.map(normalizeHdd).filter((h) => h.id);
    CATALOG.SWITCHES = swRaw.map(normalizeSwitch).filter((s) => s.id);
    CATALOG.SCREENS = screensRaw.map(normalizeScreen).filter((s) => s.id);
    CATALOG.ENCLOSURES = enclosuresRaw.map(normalizeEnclosure).filter((e) => e.id);
    CATALOG.SIGNAGE = (signageRaw || []).map(normalizeSignageRow).filter(Boolean);

    if (typeof applyLocalMediaToCatalog === "function") applyLocalMediaToCatalog();

    const mappings = accRaw.map(normalizeAccessoryMapping).filter(Boolean);
    CATALOG.ACCESSORIES_MAP = new Map(mappings.map((m) => [m.cameraId, m]));

    if (DOM.dataStatusEl) {
      const parts = [
        "Donn\u00e9es charg\u00e9es \u2705",
        "Cam\u00e9ras: " + CATALOG.CAMERAS.length,
        "NVR: " + CATALOG.NVRS.length,
        "HDD: " + CATALOG.HDDS.length,
        "Switch: " + CATALOG.SWITCHES.length,
        "\u00c9crans: " + CATALOG.SCREENS.length,
        "Bo\u00eetiers: " + CATALOG.ENCLOSURES.length,
        "Panneaux: " + CATALOG.SIGNAGE.length,
        "Mappings accessoires: " + CATALOG.ACCESSORIES_MAP.size,
      ];
      DOM.dataStatusEl.textContent = parts.join(" \u2022 ");
    }

    if (typeof sanity === "function") sanity();

    if (typeof setLastProject === "function") setLastProject(null);
    MODEL.ui.resultsShown = false;

    if (typeof syncResultsUI === "function") syncResultsUI();
    if (typeof render === "function") render();
    if (typeof updateNavButtons === "function") updateNavButtons();

  } catch (e) {
    console.error(e);
    if (DOM.dataStatusEl) DOM.dataStatusEl.textContent = "Erreur chargement donn\u00e9es \u274c";
    alert(
      "Erreur chargement data: " + e.message +
      "\n\nV\u00e9rifie:\n- dossier /data\n- fichiers cameras.csv / nvrs.csv / hdds.csv / switches.csv / accessories.csv\n- serveur local (http://localhost:8000)"
    );
  }
}

if (typeof window !== 'undefined') {
  window._initPure = initPure;
}
