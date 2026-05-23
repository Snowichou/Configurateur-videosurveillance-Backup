// ============================================================
// engine/poe.js — Moteur de planification PoE switches
// ============================================================
//
// Fonction PURE extraite de app.js (Phase 1 refactor).
// Aucune dépendance à `MODEL`, `CATALOG` ou DOM : le catalogue
// de switches est passé en paramètre, ce qui rend le module
// 100% testable.
//
// Exports :
//   - planPoESwitches(totalCameras, reservePct, nvr, catalogSwitches)
//     → plan optimisé (greedy ports d'abord, puis surplus mini)
//
// Exposé sur window pour la rétro-compatibilité avec l'IIFE app.js.
// ============================================================

/**
 * Catalogue par défaut de switches PoE (utilisé si catalogue vide).
 * Format Comelit standard : 4 / 8 / 16 / 24 ports.
 */
const DEFAULT_SWITCH_CATALOG = Object.freeze([
  { id: 'SW-POE-24', name: 'Switch PoE 24 ports', poe_ports: 24 },
  { id: 'SW-POE-16', name: 'Switch PoE 16 ports', poe_ports: 16 },
  { id: 'SW-POE-08', name: 'Switch PoE 8 ports', poe_ports: 8 },
  { id: 'SW-POE-04', name: 'Switch PoE 4 ports', poe_ports: 4 },
]);

/**
 * Planifie le nombre et la taille de switches PoE nécessaires.
 *
 * Logique :
 *   1. Le NVR a éventuellement des ports PoE intégrés → on en tient compte
 *      sauf si nvr.poe_ports === 0 (auquel cas TOUTES les caméras passent par switch)
 *   2. Réserve de ports : portsNeeded = ceil(caméras × (1 + reservePct/100))
 *   3. Greedy : gros ports d'abord (24 → 16 → 8 → 4)
 *   4. Compléter avec le switch dont le surplus est minimal
 *
 * @param {number} totalCameras                  - Nombre total de caméras
 * @param {number} [reservePct=10]              - Réserve de ports en %
 * @param {Object|null} [nvr=null]              - NVR sélectionné (lecture poe_ports)
 * @param {Array<{poe_ports:number, id?:string, name?:string}>} [catalogSwitches] - Catalogue
 * @returns {Object} { required, portsNeeded, totalPorts, plan, surplusPorts,
 *                     nvrPoePorts, camerasOnNvr, camerasOnSwitches, cameraDistribution? }
 */
export function planPoESwitches(totalCameras, reservePct = 10, nvr = null, catalogSwitches = null) {
  const nvrPoePorts = nvr?.poe_ports ?? 0;
  const camerasNeedingSwitch = Math.max(0, totalCameras - nvrPoePorts);

  // Pas besoin de switch si le NVR couvre déjà toutes les caméras
  if (camerasNeedingSwitch <= 0) {
    return {
      required: false,
      portsNeeded: 0,
      totalPorts: 0,
      plan: [],
      surplusPorts: 0,
      nvrPoePorts,
      camerasOnNvr: totalCameras,
      camerasOnSwitches: 0,
    };
  }

  // Si le NVR n'a aucun port PoE, toutes les caméras passent par switch
  const camerasViaSwitch = nvrPoePorts > 0 ? camerasNeedingSwitch : totalCameras;
  const portsNeeded = Math.ceil(camerasViaSwitch * (1 + reservePct / 100));

  // Catalogue : utiliser celui fourni (filtré + trié desc), sinon défaut
  const providedCatalog = Array.isArray(catalogSwitches) ? catalogSwitches : [];
  const catalog = providedCatalog.length
    ? providedCatalog.filter((s) => (s?.poe_ports ?? 0) > 0).sort((a, b) => b.poe_ports - a.poe_ports)
    : [...DEFAULT_SWITCH_CATALOG];

  const plan = [];
  let remaining = portsNeeded;

  // Greedy : on prend autant de gros switches que possible
  for (const sw of catalog) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / sw.poe_ports);
    if (count > 0) {
      plan.push({ item: sw, qty: count });
      remaining -= count * sw.poe_ports;
    }
  }

  // Compléter avec le switch dont le surplus est minimal
  if (remaining > 0) {
    let best = null;
    for (const sw of catalog) {
      const surplus = sw.poe_ports - remaining;
      if (surplus >= 0) {
        if (
          !best ||
          surplus < best.surplus ||
          (surplus === best.surplus && sw.poe_ports < best.item.poe_ports)
        ) {
          best = { item: sw, surplus };
        }
      }
    }
    if (best) plan.push({ item: best.item, qty: 1 });
  }

  // Répartition caméras par switch (pour synoptique)
  const cameraDistribution = [];
  let camerasLeft = camerasViaSwitch;
  for (const p of plan) {
    for (let i = 0; i < p.qty; i++) {
      const onThisSwitch = Math.min(camerasLeft, p.item.poe_ports);
      cameraDistribution.push({
        switch: p.item,
        camerasConnected: onThisSwitch,
        totalPorts: p.item.poe_ports,
      });
      camerasLeft -= onThisSwitch;
    }
  }

  const totalPorts = plan.reduce((s, p) => s + p.item.poe_ports * p.qty, 0);
  return {
    required: true,
    portsNeeded,
    totalPorts,
    plan,
    surplusPorts: totalPorts - portsNeeded,
    nvrPoePorts,
    camerasOnNvr: nvrPoePorts > 0 ? Math.min(totalCameras, nvrPoePorts) : 0,
    camerasOnSwitches: camerasViaSwitch,
    cameraDistribution,
  };
}

// ─── Compat global (legacy app.js) ──────────────────────────
// Le wrapper dans app.js injecte CATALOG.SWITCHES (global non importable depuis ESM).
if (typeof window !== 'undefined') {
  window._planPoESwitchesPure = planPoESwitches;
}
