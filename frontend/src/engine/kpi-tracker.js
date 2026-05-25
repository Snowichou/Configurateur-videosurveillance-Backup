/**
 * engine/kpi-tracker.js — Tracker KPI côté backend (session + send)
 * PH6.1 — extrait de app.js (IIFE externe, lignes 36-90)
 *
 * Auto-configure window.KPI et window.kpi.
 * Pas de dépendances externes.
 */

const SESSION_KEY = "cfg_session_id";

function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = (crypto?.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

async function send(event, payload = {}) {
  try {
    const body = {
      session_id: getSessionId(),
      event: String(event || "").slice(0, 80),
      payload: payload && typeof payload === "object" ? payload : { value: payload },
    };
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

function sendNowait(event, payload = {}) {
  try { send(event, payload); } catch {}
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
