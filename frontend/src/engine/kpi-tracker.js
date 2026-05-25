/**
 * engine/kpi-tracker.js — Tracker KPI côté backend (session + send + snapshot)
 * PH6.1 — extrait de app.js (IIFE externe)
 * PH6.1b — createKpiSnapshot (compactCameras + snapshot, avec deps)
 *
 * Exports:
 *   KPI                    — { send, sendNowait, getSessionId }
 *   createKpiSnapshot(deps) — factory → snapshot(proj)
 *     deps: { MODEL, getCameraById, getSessionId? }
 *
 * Auto-configure window.KPI et window.kpi.
 */

const SESSION_KEY = "cfg_session_id";

export function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = (crypto?.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function _buildBody(event, payload) {
  return {
    session_id: getSessionId(),
    event: String(event || "").slice(0, 80),
    payload: payload && typeof payload === "object" ? payload : { value: payload },
  };
}

export async function send(event, payload = {}) {
  try {
    const body = _buildBody(event, payload);
    await fetch("/api/kpi/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-page-path": location.pathname + location.search + location.hash,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // jamais casser l'app pour un KPI
  }
}

export function sendNowait(event, payload = {}) {
  try {
    const body = _buildBody(event, payload);
    fetch("/api/kpi/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-page-path": location.pathname + location.search + location.hash,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export const KPI = { send, sendNowait, getSessionId };

// Rend KPI accessible partout (handlers inclus)
window.KPI = KPI;

// Compat : si du code appelle kpi("event", {...})
window.kpi = function kpi(event, payload = {}) {
  try {
    if (window.KPI?.sendNowait) window.KPI.sendNowait(event, payload);
    else if (window.KPI?.send) window.KPI.send(event, payload);
  } catch {}
};

// ─── Snapshot métier (deps: MODEL, getCameraById) ────────────────────────────

export function createKpiSnapshot(deps = {}) {
  const {
    MODEL,
    getCameraById,
    getSessionId: _getSessionId = getSessionId,
  } = deps;

  function compactCameras() {
    const lines = Array.isArray(MODEL?.cameraLines) ? MODEL.cameraLines : [];
    const blocks = Array.isArray(MODEL?.cameraBlocks) ? MODEL.cameraBlocks : [];
    const cams = [];

    for (const l of lines) {
      const camId = l?.cameraId;
      if (!camId) continue;
      const cam = (typeof getCameraById === "function") ? getCameraById(camId) : null;
      if (!cam) continue;
      const block = blocks.find(b => b.id === l.fromBlockId);
      const objective = block?.answers?.objective || block?.objective || null;
      cams.push({
        id: cam.id,
        name: cam.name || "",
        qty: Number(l.qty || 0) || 0,
        brand_range: cam.brand_range || "",
        objective: objective,
        emplacement: block?.answers?.emplacement || null,
        distance_m: (Number(block?.answers?.distance_m) > 0 ? Number(block.answers.distance_m) : null),
      });
    }
    return cams.filter(c => c.qty > 0);
  }

  function snapshot(proj) {
    const cams = compactCameras();
    const cam_total_qty = cams.reduce((a, c) => a + (Number(c.qty) || 0), 0);
    const nvr_id = proj?.nvrPick?.nvr?.id || proj?.nvr?.id || null;

    const config_type =
      MODEL?.projectUseCase ||
      proj?.siteType || proj?.vertical || proj?.environment ||
      (cam_total_qty >= 8 ? "multi-cam" : "petit-site");

    const comp = MODEL?.complements || {};
    const screen_enabled    = !!comp?.screen?.enabled;
    const enclosure_enabled = !!comp?.enclosure?.enabled;
    const signage_enabled   = !!comp?.signage?.enabled;
    const screen_size_inch  = screen_enabled ? (Number(comp?.screen?.sizeInch || 0) || null) : null;
    const screen_qty        = screen_enabled ? (Number(comp?.screen?.qty || 1) || 1) : null;
    const signage_scope     = signage_enabled ? String(comp?.signage?.scope || "Public") : null;
    const signage_qty       = signage_enabled ? (Number(comp?.signage?.qty || 1) || 1) : null;

    const hdd_ref  = proj?.disks?.hddRef || null;
    const hdd_id   = hdd_ref?.id || null;
    const hdd_name = hdd_ref?.name || null;
    const hdd_qty  = (hdd_ref && proj?.disks?.count) ? Number(proj.disks.count) : null;

    const sp = proj?.storageParams || {};
    const required_tb = Number(proj?.requiredTB ?? proj?.rawRequiredTB ?? 0) > 0
      ? Number(proj?.requiredTB ?? proj?.rawRequiredTB) : null;
    const total_mbps  = Number(proj?.totalInMbps ?? 0) > 0
      ? Number(proj.totalInMbps) : null;

    const rec_codec = sp.codec ?? MODEL?.recording?.codec ?? null;
    const rec_fps   = sp.ips   ?? MODEL?.recording?.fps   ?? null;
    const rec_days  = sp.daysRetention  ?? MODEL?.recording?.daysRetention  ?? null;
    const rec_hours = sp.hoursPerDay    ?? MODEL?.recording?.hoursPerDay    ?? null;
    const rec_mode  = sp.mode           ?? MODEL?.recording?.mode           ?? null;

    return {
      sid: _getSessionId(),
      config_type,
      cam_total_qty,
      unique_cam_models: cams.length,
      cameras: cams,
      nvr_id,
      requiredTB:  required_tb,
      totalInMbps: total_mbps,
      recording: {
        daysRetention: rec_days,
        hoursPerDay:   rec_hours,
        codec:         rec_codec,
        fps:           rec_fps,
        mode:          rec_mode,
      },
      hdd_id, hdd_name, hdd_qty,
      complements: {
        screen_enabled, screen_size_inch, screen_qty,
        enclosure_enabled,
        signage_enabled, signage_scope, signage_qty,
      },
    };
  }

  return snapshot;
}

window._createKpiSnapshot = createKpiSnapshot;
