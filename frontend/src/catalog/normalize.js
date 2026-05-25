// ============================================================
// catalog/normalize.js — Normalizers CSV → objets métier
// ============================================================
//
// Fonctions PURES extraites de app.js (Phase 1 refactor).
// Toutes ces fonctions sont 100% testables sans monter MODEL/CATALOG/DOM.
// ============================================================

import { toBool, toNum, toStrOrFalse, isFalseLike, clampInt } from '../utils/format.js';

export function safeStr(v) {
  return (v ?? '').toString().trim();
}

export function safeNum(v) {
  const n = Number((v ?? '').toString().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function splitList(v, sep = '|') {
  if (v == null) return [];
  const s = String(v).trim();
  if (!s) return [];
  return s.split(sep).map((x) => x.trim()).filter(Boolean);
}

export function parsePipeList(v) {
  return splitList(safeStr(v), '|');
}

export function localizedDatasheetUrl(url, lang = 'fr') {
  if (!url || url === 'false') return url;
  const localeMap = { fr: 'fr_FR', en: 'en_GB', it: 'it_IT', es: 'es_ES', de: 'de_DE' };
  const localeMapDash = { fr: 'fr-fr', en: 'en-gb', it: 'it-it', es: 'es-es', de: 'de-de' };
  const targetLocale = localeMap[lang] || 'fr_FR';
  const targetLocaleDash = localeMapDash[lang] || 'fr-fr';
  let result = url.replace(/\/fr_FR\//g, '/' + targetLocale + '/');
  result = result.replace(/\/fr-fr\//g, '/' + targetLocaleDash + '/');
  return result;
}

const fallbackLocalizedName = (raw, field = 'name') => safeStr(raw?.[field]);

// ─── Normalizers simples ────────────────────────────────────

export function normalizeHdd(raw, localizedName = fallbackLocalizedName) {
  return {
    id: raw.id,
    name: localizedName(raw),
    capacity_tb: safeNum(raw.capacity_tb),
    image_url: raw.image_url || '',
    datasheet_url: raw.datasheet_url || '',
  };
}

export function normalizeSwitch(raw, localizedName = fallbackLocalizedName) {
  return {
    id: raw.id,
    name: localizedName(raw),
    poe_ports: safeNum(raw.poe_ports) ?? 0,
    poe_budget_w: safeNum(raw.poe_budget_w),
    uplink_gbps: safeNum(raw.uplink_gbps),
    managed: !!(
      raw.managed === true ||
      String(raw.managed ?? '').toLowerCase() === 'true' ||
      String(raw.managed ?? '').toLowerCase() === '1' ||
      String(raw.managed ?? '').toLowerCase() === 'yes'
    ),
    image_url: raw.image_url || '',
    datasheet_url: raw.datasheet_url || '',
    notes: raw.notes || '',
  };
}

export function normalizeScreen(row, localizedName = fallbackLocalizedName) {
  const id = safeStr(row.id);
  const sizeRaw = safeStr(row.size_inch);
  const n = Number(String(sizeRaw || '').trim().replace(',', '.'));
  const size = Number.isFinite(n) && n > 0 ? n : null;
  return {
    id,
    name: localizedName(row) || id || '—',
    size_inch: size,
    format: safeStr(row.format) || '—',
    vesa: safeStr(row.vesa) || '—',
    resolution: safeStr(row.Resolution || row.resolution) || '—',
    image_url: safeStr(row.image_url) || '',
    datasheet_url: safeStr(row.datasheet_url) || '',
  };
}

export function normalizeEnclosure(row, localizedName = fallbackLocalizedName) {
  const id = safeStr(row.id);
  return {
    id,
    name: localizedName(row) || id || '—',
    screen_compatible_with: parsePipeList(row.screen_compatible_with),
    compatible_with: parsePipeList(row.compatible_with),
    image_url: safeStr(row.image_url) || '',
    datasheet_url: safeStr(row.datasheet_url) || '',
  };
}

export function normalizeSignageRow(raw) {
  if (!raw) return null;
  const id = safeStr(raw.id);
  if (!id) return null;
  const name = safeStr(raw.name) || id;
  const material = safeStr(raw.material);
  const fixing = safeStr(raw.fixing);
  const dimension = safeStr(raw.Dimension ?? raw.dimension);
  const scope = safeStr(raw.Prive_Public ?? raw.prive_public ?? raw.scope ?? raw.type) || 'Public';
  const image_url = safeStr(raw.image_url);
  const datasheet_url = safeStr(raw.datasheet_url);
  return { id, name, material, fixing, dimension, scope, image_url, datasheet_url };
}

// ─── Helpers caméra ─────────────────────────────────────────

export function parseRobustNum(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const s = String(v).trim();
  if (!s) return fallback;
  const ipik = s.match(/^(IP|IK)\s*([0-9]{2})$/i);
  if (ipik) return Number(ipik[2]);
  const cleaned = s.replace(',', '.').replace(/\s+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function extractUseCasesFromRow(raw) {
  const cols = ['use_cases_01', 'use_cases_02', 'use_cases_03'];
  const out = [];
  for (const k of cols) {
    const v = raw[k];
    if (!isFalseLike(v)) out.push(String(v).trim());
  }
  if (!out.length) {
    const legacy = raw.use_cases ?? raw.use_case ?? raw.useCases ?? '';
    const fromPipe = splitList(legacy, '|');
    if (fromPipe.length) return fromPipe;
    if (!isFalseLike(legacy)) return [String(legacy).trim()];
  }
  return [...new Set(out)].filter(Boolean);
}

// ─── Normalizers complexes ──────────────────────────────────

export function normalizeCamera(raw, localizedName = fallbackLocalizedName) {
  const useCases = extractUseCasesFromRow(raw);
  const emplInt = toBool(raw.Emplacement_Interieur ?? raw.emplacement_interieur ?? raw.interieur);
  const emplExt = toBool(raw.Emplacement_Exterieur ?? raw.emplacement_exterieur ?? raw.exterieur);
  return {
    id: String(raw.id ?? '').trim(),
    name: localizedName(raw) || '',
    brand_range: raw.brand_range || '',
    family: raw.family || 'standard',
    type: raw.form_factor || raw.type || '',
    emplacement_interieur: !!emplInt,
    emplacement_exterieur: !!emplExt,
    resolution_mp: parseRobustNum(raw.resolution_mp, 0),
    sensor_count: parseRobustNum(raw.sensor_count, 0),
    lens_type: raw.lens_type || '',
    focal_min_mm: parseRobustNum(raw.focal_min_mm, null),
    focal_max_mm: parseRobustNum(raw.focal_max_mm, null),
    dori_detection_m: parseRobustNum(raw.dori_detection_m, 0),
    dori_observation_m: parseRobustNum(raw.dori_observation_m, 0),
    dori_recognition_m: parseRobustNum(raw.dori_recognition_m, 0),
    dori_identification_m: parseRobustNum(raw.dori_identification_m, 0),
    ir_range_m: parseRobustNum(raw.ir_range_m, 0),
    white_led_range_m: parseRobustNum(raw.white_led_range_m, 0),
    low_light_raw: raw.low_light_mode || raw.low_light || '',
    low_light: !!String(raw.low_light_mode ?? raw.low_light ?? '').trim(),
    ip: parseRobustNum(raw.ip, null),
    ik: parseRobustNum(raw.ik, null),
    microphone: toBool(raw.Microphone ?? raw.microphone),
    poe_w: parseRobustNum(raw.poe_w, 0),
    bitrate_mbps_typical: parseRobustNum(raw.bitrate_mbps_typical, null),
    streams_max: parseRobustNum(raw.streams_max, null),
    analytics_level: raw.analytics_level || '',
    use_cases: useCases,
    image_url: raw.image_url || '',
    datasheet_url: raw.datasheet_url || '',
  };
}

export function normalizeNvr(raw, localizedName = fallbackLocalizedName) {
  return {
    id: raw.id,
    name: localizedName(raw),
    brand_range: String(raw.brand_range || '').trim(),
    channels: toNum(raw.channels) ?? 0,
    max_in_mbps: toNum(raw.max_in_mbps) ?? 0,
    nvr_output: clampInt(raw.nvr_output ?? 1, 1, 8),
    hdd_bays: toNum(raw.hdd_bays) ?? 0,
    max_hdd_tb_per_bay: toNum(raw.max_hdd_tb_per_bay) ?? 0,
    poe_ports: toNum(raw.poe_ports) ?? 0,
    poe_budget_w: toNum(raw.poe_budget_w) ?? 0,
    image_url: raw.image_url || '',
    datasheet_url: raw.datasheet_url || '',
  };
}

export function normalizeMappedAccessory({ id, name, type, image_url, datasheet_url, stand_alone }) {
  if (isFalseLike(id)) return null;
  return {
    id: String(id).trim(),
    name: toStrOrFalse(name) || String(id).trim(),
    type,
    image_url: toStrOrFalse(image_url) || false,
    datasheet_url: toStrOrFalse(datasheet_url) || false,
    stand_alone: !!stand_alone,
  };
}

export function normalizeAccessoryMapping(raw, localizedName = fallbackLocalizedName) {
  const bomKey = '\uFEFFcamera_id';
  const cameraId = toStrOrFalse(raw.camera_id ?? raw[bomKey]);
  if (!cameraId) return null;
  const qty = clampInt(raw.qty, 1, 999);
  const junction = normalizeMappedAccessory({
    id: raw.junction_box_id,
    name: localizedName(raw, 'junction_box_name'),
    type: 'junction_box',
    image_url: raw.image_url_junction_box,
    datasheet_url: raw.datasheet_url_junction_box,
    stand_alone: false,
  });
  const wall = normalizeMappedAccessory({
    id: raw.wall_mount_id,
    name: localizedName(raw, 'wall_mount_name'),
    type: 'wall_mount',
    image_url: raw.image_url_wall_mount,
    datasheet_url: raw.datasheet_url_wall_mount,
    stand_alone: toBool(raw.wall_mount_stand_alone),
  });
  const ceiling = normalizeMappedAccessory({
    id: raw.ceiling_mount_id,
    name: localizedName(raw, 'ceiling_mount_name'),
    type: 'ceiling_mount',
    image_url: raw.image_url_ceiling_mount,
    datasheet_url: raw.datasheet_url_ceiling_mount,
    stand_alone: toBool(raw.ceiling_mount_stand_alone),
  });
  const pole = normalizeMappedAccessory({
    id: raw.pole_mount_id,
    name: localizedName(raw, 'pole_mount_name'),
    type: 'pole_mount',
    image_url: raw.image_url_pole_mount,
    datasheet_url: raw.datasheet_url_pole_mount,
    stand_alone: toBool(raw.pole_mount_stand_alone),
  });
  const corner = normalizeMappedAccessory({
    id: raw.corner_mount_id,
    name: localizedName(raw, 'corner_mount_name'),
    type: 'corner_mount',
    image_url: raw.image_url_corner_mount,
    datasheet_url: raw.datasheet_url_corner_mount,
    stand_alone: toBool(raw.corner_mount_stand_alone),
  });
  return { cameraId: String(cameraId).trim(), qty, junction, wall, ceiling, pole, corner };
}

// ─── Compat globals (legacy app.js) ─────────────────────────
if (typeof window !== 'undefined') {
  window.safeStr = safeStr;
  window.safeNum = safeNum;
  window.splitList = splitList;
  window.parsePipeList = parsePipeList;
  window.localizedDatasheetUrl = localizedDatasheetUrl;
  window.parseRobustNum = parseRobustNum;
  window.extractUseCasesFromRow = extractUseCasesFromRow;
}
