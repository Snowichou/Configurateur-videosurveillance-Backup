/**
 * ui/toast.js — Notification toast DOM
 * PH4.4b — extrait de app.js
 *
 * Exports:
 *   showToastPure(message, type, CLR)
 *     type: "ok" | "warn" | "danger"
 *     CLR: { green, warn, danger } (couleurs de CONFIG.colors)
 */

export function showToastPure(message, type, CLR) {
  const existing = document.getElementById('cfgToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'cfgToast';
  const bg = type === 'ok' ? CLR.green : type === 'warn' ? CLR.warn : CLR.danger;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '99999', padding: '14px 24px', borderRadius: '12px',
    background: bg, color: '#fff', fontWeight: '800', fontSize: '13px',
    boxShadow: '0 8px 32px rgba(0,0,0,.25)', transition: 'opacity .3s ease, transform .3s ease',
  });
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

