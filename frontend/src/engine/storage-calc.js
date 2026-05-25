/**
 * engine/storage-calc.js — Calculs stockage HDD
 * PH5.2a — extrait de app.js
 *
 * Exports:
 *   mbpsToTB(mbps, hoursPerDay, days, overheadPct) — conversion débit → TB
 *   pickDisks(requiredTB, nvr, hdds)               — sélection HDD optimale
 */

export function mbpsToTB(mbps, hoursPerDay, days, overheadPct) {
  const seconds = hoursPerDay * 3600 * days;
  const bits = mbps * 1_000_000 * seconds;
  const bytes = bits / 8;
  let tb = bytes / 1_000_000_000_000;
  tb *= (1 + (overheadPct / 100));
  return tb;
}

export function pickDisks(requiredTB, nvr, hdds) {
  if (!nvr) return null;
  const bays = nvr.hdd_bays ?? 0;
  const maxPerBay = nvr.max_hdd_tb_per_bay ?? 0;
  const maxTotalTB = bays * maxPerBay;

  const sizesFromHdds = [...new Set((hdds || []).map((h) => h.capacity_tb).filter((x) => Number.isFinite(x)))]
    .sort((a, b) => b - a);

  const candidateSizes = sizesFromHdds.length ? sizesFromHdds : [16, 12, 8, 4];

  let best = null;
  for (const size of candidateSizes) {
    if (size > maxPerBay) continue;
    const needed = Math.ceil(requiredTB / size);
    if (needed <= bays) {
      best = { sizeTB: size, count: needed, totalTB: needed * size };
      break;
    }
  }

  if (!best) {
    const size = Math.min(maxPerBay, candidateSizes[0] ?? maxPerBay);
    best = { sizeTB: size, count: bays, totalTB: bays * size };
  }

  const hddRef = (hdds || []).find((h) => h.capacity_tb === best.sizeTB) || null;
  return { ...best, maxTotalTB, hddRef };
}

