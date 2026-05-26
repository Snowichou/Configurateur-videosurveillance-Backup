// ============================================================
// engine/storage.js — Moteur de calcul stockage HDD
// ============================================================
//
// Fonctions PURES extraites de app.js (Phase 1 refactor).
// Aucune dépendance à `MODEL`, `CATALOG` ou DOM : tout est passé
// en paramètres, ce qui rend le module 100% testable.
//
// Exports :
//   - mbpsToTB(mbps, hoursPerDay, days, overheadPct) : conversion débit → stockage
//   - getContextualMotionFactor(blk, projectUseCase) : facteur motion contextualisé
//   - pickDisks(requiredTB, nvr, catalogHdds) : choix HDDs (greedy + mixed sizes)
//
// Exposés sur window pour la rétro-compatibilité avec l'IIFE de app.js.
// ============================================================

/**
 * Convertit un débit Mbps + durée en stockage requis en To (base 10, SI).
 *
 * Formule : Mbps × 10^6 × secondes / 8 / 10^12 × (1 + overhead/100)
 *
 * @param {number} mbps         - Débit total entrant (Mbps)
 * @param {number} hoursPerDay  - Heures d'enregistrement par jour (1-24)
 * @param {number} days         - Durée de rétention en jours
 * @param {number} overheadPct  - Marge de sécurité en % (0-50)
 * @returns {number} Stockage requis en To
 */
export function mbpsToTB(mbps, hoursPerDay, days, overheadPct) {
  const seconds = hoursPerDay * 3600 * days;
  const bits = mbps * 1_000_000 * seconds;
  const bytes = bits / 8;
  let tb = bytes / 1_000_000_000_000;
  tb *= 1 + overheadPct / 100;
  return tb;
}

/**
 * Facteur motion contextualisé selon le type de site + emplacement du bloc.
 *
 * Le mode "détection de mouvement" économise du stockage, mais l'économie
 * varie selon le contexte :
 *   - Résidentiel intérieur ≈ 0.25 (peu d'activité nuit, économie ~75%)
 *   - Tertiaire intérieur ≈ 0.30
 *   - Parking extérieur ≈ 0.58 (passage fréquent)
 *   - Industriel extérieur ≈ 0.55
 *
 * @param {Object|null|undefined} blk - Bloc caméra (lecture answers.emplacement)
 * @param {string} projectUseCase     - Type de site du projet
 * @returns {number} Facteur dans [0.20, 0.70]
 */
export function getContextualMotionFactor(blk, projectUseCase) {
  if (!blk) return 0.4;
  const emp = String(blk?.answers?.emplacement || '').toLowerCase();
  const uc = String(projectUseCase || '').toLowerCase();

  // Base par emplacement
  let factor = emp.startsWith('ext') ? 0.5 : 0.3;

  // Modulation par type de site (détection multi-langues)
  if (
    uc.includes('résidentiel') ||
    uc.includes('residential') ||
    uc.includes('residenziale') ||
    uc.includes('residencial') ||
    uc.includes('wohngeb')
  ) {
    factor *= 0.85;
  } else if (
    uc.includes('parking') ||
    uc.includes('aparcamiento') ||
    uc.includes('parcheggio') ||
    uc.includes('parkplatz')
  ) {
    factor *= 1.15;
  } else if (uc.includes('industriel') || uc.includes('industri') || uc.includes('warehouse')) {
    factor *= 1.1;
  } else if (
    uc.includes('tertiaire') ||
    uc.includes('tertiar') ||
    uc.includes('terziario') ||
    uc.includes('terciario') ||
    uc.includes('gewerbe') ||
    uc.includes('office')
  ) {
    factor *= 1.0;
  } else if (
    uc.includes('collectif') ||
    uc.includes('collective') ||
    uc.includes('multi-dwell') ||
    uc.includes('condominio') ||
    uc.includes('vivienda colectiva') ||
    uc.includes('mehrfamilien')
  ) {
    factor *= 1.0;
  }

  return Math.max(0.2, Math.min(0.7, factor));
}

/**
 * Sélectionne la combinaison optimale de disques durs pour un NVR donné.
 *
 * Algorithme :
 *   1. Greedy single-size : plus grande capacité couvrant le besoin en 1 type
 *   2. Mixed 2-sizes : si économie de gaspillage > 5%, mixer 2 tailles
 *   3. Fallback : remplir toutes les baies au max si requis > capacité max
 *
 * @param {number} requiredTB     - Stockage requis en To
 * @param {Object|null} nvr       - NVR sélectionné (lecture hdd_bays + max_hdd_tb_per_bay)
 * @param {Array<{capacity_tb:number, id?:string}>} catalogHdds - Catalogue HDDs disponibles
 * @returns {Object|null} { sizeTB, count, totalTB, mixed, composition, maxTotalTB, hddRef }
 */
export function pickDisks(requiredTB, nvr, catalogHdds) {
  if (!nvr) return null;
  const bays = nvr.hdd_bays ?? 0;
  const maxPerBay = nvr.max_hdd_tb_per_bay ?? 0;
  const maxTotalTB = bays * maxPerBay;

  const sizesFromHdds = [
    ...new Set((catalogHdds || []).map((h) => h.capacity_tb).filter((x) => Number.isFinite(x))),
  ].sort((a, b) => b - a);
  const candidateSizes = (sizesFromHdds.length ? sizesFromHdds : [16, 12, 8, 4]).filter(
    (s) => s <= maxPerBay
  );

  if (!candidateSizes.length || bays <= 0) {
    return {
      sizeTB: maxPerBay || 4,
      count: Math.max(1, bays),
      totalTB: (maxPerBay || 4) * Math.max(1, bays),
      mixed: false,
      composition: [],
      maxTotalTB,
      hddRef: null,
    };
  }

  // Étape 1 — Greedy single-size
  let bestSingle = null;
  for (const size of candidateSizes) {
    const needed = Math.ceil(requiredTB / size);
    if (needed <= bays) {
      bestSingle = { sizeTB: size, count: needed, totalTB: needed * size, mixed: false };
      break;
    }
  }

  // Étape 2 — Mixed 2-sizes
  let bestMixed = null;
  if (requiredTB > 0 && candidateSizes.length >= 2) {
    for (let i = 0; i < candidateSizes.length; i++) {
      const s1 = candidateSizes[i];
      for (let j = i + 1; j < candidateSizes.length; j++) {
        const s2 = candidateSizes[j];
        for (let c1 = 1; c1 <= bays; c1++) {
          const remaining = requiredTB - c1 * s1;
          if (remaining <= 0) break;
          const c2 = Math.ceil(remaining / s2);
          if (c1 + c2 > bays) continue;
          const total = c1 * s1 + c2 * s2;
          const waste = total - requiredTB;
          const baysUsed = c1 + c2;
          const candidate = {
            size1: s1,
            count1: c1,
            size2: s2,
            count2: c2,
            totalTB: total,
            baysUsed,
            waste,
          };
          if (
            !bestMixed ||
            waste < bestMixed.waste ||
            (waste === bestMixed.waste && baysUsed < bestMixed.baysUsed)
          ) {
            bestMixed = candidate;
          }
        }
      }
    }
  }

  // Choix final : mixed si gain significatif (>5%), sinon single
  let best;
  if (bestSingle && bestMixed) {
    const singleWaste = bestSingle.totalTB - requiredTB;
    const significantGain =
      singleWaste > 0 && (singleWaste - bestMixed.waste) / Math.max(1, singleWaste) > 0.05;
    if (bestMixed.waste < singleWaste && significantGain) {
      best = {
        sizeTB: bestMixed.size1,
        count: bestMixed.count1 + bestMixed.count2,
        totalTB: bestMixed.totalTB,
        mixed: true,
        composition: [
          { sizeTB: bestMixed.size1, count: bestMixed.count1 },
          { sizeTB: bestMixed.size2, count: bestMixed.count2 },
        ],
      };
    } else {
      best = {
        ...bestSingle,
        composition: [{ sizeTB: bestSingle.sizeTB, count: bestSingle.count }],
      };
    }
  } else if (bestSingle) {
    best = { ...bestSingle, composition: [{ sizeTB: bestSingle.sizeTB, count: bestSingle.count }] };
  } else if (bestMixed) {
    best = {
      sizeTB: bestMixed.size1,
      count: bestMixed.count1 + bestMixed.count2,
      totalTB: bestMixed.totalTB,
      mixed: true,
      composition: [
        { sizeTB: bestMixed.size1, count: bestMixed.count1 },
        { sizeTB: bestMixed.size2, count: bestMixed.count2 },
      ],
    };
  } else {
    const size = candidateSizes[0];
    best = {
      sizeTB: size,
      count: bays,
      totalTB: bays * size,
      mixed: false,
      composition: [{ sizeTB: size, count: bays }],
    };
  }

  const hddRef = (catalogHdds || []).find((h) => h.capacity_tb === best.sizeTB) || null;
  return { ...best, maxTotalTB, hddRef };
}

// ─── Compat globals (legacy app.js) ─────────────────────────
// L'IIFE de app.js utilise ces fonctions sans pouvoir les importer.
// On expose sur window pour préserver le comportement actuel.
// Quand la suite du refactor migrera app.js → modules ESM, on pourra
// supprimer ces exports globaux.
if (typeof window !== 'undefined') {// pickDisks reste dans app.js comme wrapper (utilise CATALOG.HDDS global)
}
