// ============================================================
// ui/measure/photo-viewer.js — Lightbox de la photo de mesure
// ============================================================
//
// Affiche la photo stockée en local (IndexedDB) pour une caméra,
// avec la distance/hauteur mesurées. Lecture seule + bouton supprimer.
// Robuste : si la photo est introuvable (IndexedDB indisponible ou
// effacée), un message clair s'affiche.
//
// API : openPhotoViewer({ getPhoto, projectId, cameraId, onDelete })
// ============================================================

/**
 * @param {Object} opts
 * @param {(projectId:string, cameraId:string)=>Promise<Object|null>} opts.getPhoto
 * @param {string} opts.projectId
 * @param {string} opts.cameraId
 * @param {() => void} [opts.onDelete] - callback après suppression confirmée
 */
export function openPhotoViewer({ getPhoto, projectId, cameraId, onDelete } = {}) {
  let objUrl = null;

  const overlay = document.createElement('div');
  overlay.className = 'photoViewerOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);' +
    'display:flex;align-items:center;justify-content:center;padding:14px;';

  overlay.innerHTML = `
    <div style="width:100%;max-width:480px;max-height:94vh;overflow:auto;
        background:var(--panel2,#161a20);color:var(--text,#e8eef5);
        border:1px solid var(--line,#2a3240);border-radius:16px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong>📷 Photo de mesure</strong>
        <button type="button" data-pv="close" aria-label="Fermer" style="background:transparent;
          border:0;color:var(--text,#e8eef5);font-size:22px;line-height:1;cursor:pointer;padding:4px 8px">✕</button>
      </div>
      <div data-pv="body" style="font-size:13px">Chargement…</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" data-pv="del" style="flex:1;padding:10px;border-radius:11px;border:0;
          background:#dc2626;color:#fff;font-weight:600;cursor:pointer;display:none">🗑️ Supprimer</button>
        <button type="button" data-pv="ok" style="flex:1;padding:10px;border-radius:11px;border:1px solid var(--line,#2a3240);
          background:transparent;color:var(--text,#e8eef5);cursor:pointer">Fermer</button>
      </div>
    </div>`;

  const q = (s) => overlay.querySelector(`[data-pv="${s}"]`);

  function cleanup() {
    if (objUrl) {
      try { URL.revokeObjectURL(objUrl); } catch { /* ignore */ }
      objUrl = null;
    }
  }
  function close() {
    cleanup();
    overlay.remove();
    window.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  q('close').addEventListener('click', close);
  q('ok').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  window.addEventListener('keydown', onKey);

  Promise.resolve(typeof getPhoto === 'function' ? getPhoto(projectId, cameraId) : null)
    .then((rec) => {
      const body = q('body');
      if (!rec || !rec.blob) {
        body.textContent = 'Aucune photo trouvée (stockage local indisponible ou supprimée).';
        return;
      }
      objUrl = URL.createObjectURL(rec.blob);
      const meta = [];
      if (rec.distanceM != null) meta.push(`distance ≈ ${rec.distanceM} m`);
      if (rec.heightM != null) meta.push(`hauteur ${rec.heightM} m`);
      body.innerHTML = `
        <img src="${objUrl}" alt="Photo de mesure" style="width:100%;border-radius:12px;display:block" />
        <div style="opacity:.8;margin-top:8px">${meta.join(' · ') || ''}</div>`;
      const del = q('del');
      del.style.display = 'block';
      del.addEventListener('click', () => {
        if (typeof onDelete === 'function') onDelete();
        close();
      });
    })
    .catch(() => {
      q('body').textContent = 'Erreur de lecture de la photo.';
    });
}
