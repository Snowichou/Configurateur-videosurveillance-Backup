/**
 * engine/persistence.js — Sauvegarde / restauration de la configuration
 * PH4.4c — extrait de app.js
 *
 * Exports (factory):
 *   createPersistenceHandlers(deps) => {
 *     snapshotForSave, restoreFromSnapshot,
 *     saveConfigToLocalStorage, loadConfigFromLocalStorage,
 *     shareConfigUrl
 *   }
 *
 * deps: { MODEL, LOG, showToast, T, generateShareUrl, invalidateProjectCache }
 */

const SAVE_KEY = 'comelit_cfg_save';

export function createPersistenceHandlers(deps = {}) {
  const {
    MODEL,
    LOG,
    showToast,
    T,
    generateShareUrl,
    invalidateProjectCache,
  } = deps;

  function snapshotForSave() {
    try {
      return {
        projectName: MODEL?.projectName || '',
        projectUseCase: MODEL?.projectUseCase || '',
        cameraBlocks: (MODEL?.cameraBlocks || []).map(b => ({
          id: b.id, label: b.label, validated: b.validated,
          selectedCameraId: b.selectedCameraId, qty: b.qty, answers: b.answers || {},
        })),
        cameraLines: (MODEL?.cameraLines || []).map(l => ({
          cameraId: l.cameraId, fromBlockId: l.fromBlockId, qty: l.qty,
        })),
        accessoryLines: (MODEL?.accessoryLines || []).map(a => ({
          accessoryId: a.accessoryId, fromBlockId: a.fromBlockId, qty: a.qty, type: a.type,
        })),
        recording: { ...(MODEL?.recording || {}) },
        complements: JSON.parse(JSON.stringify(MODEL?.complements || {})),
        savedAt: new Date().toISOString(),
      };
    } catch (e) { LOG.error('[Save] Snapshot failed:', e); return null; }
  }

  function restoreFromSnapshot(snap) {
    try {
      if (!snap) return false;
      if (snap.projectName != null) MODEL.projectName = snap.projectName;
      if (snap.projectUseCase != null) MODEL.projectUseCase = snap.projectUseCase;
      if (Array.isArray(snap.cameraBlocks)) MODEL.cameraBlocks = snap.cameraBlocks;
      if (Array.isArray(snap.cameraLines)) MODEL.cameraLines = snap.cameraLines;
      if (Array.isArray(snap.accessoryLines)) MODEL.accessoryLines = snap.accessoryLines;
      if (snap.recording) MODEL.recording = { ...MODEL.recording, ...snap.recording };
      if (snap.complements) MODEL.complements = JSON.parse(JSON.stringify(snap.complements));
      invalidateProjectCache();
      return true;
    } catch (e) { LOG.error('[Save] Restore failed:', e); return false; }
  }

  function saveConfigToLocalStorage() {
    const snap = snapshotForSave();
    if (!snap) { showToast('❌ ' + T('err_save_fail'), 'danger'); return; }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
      showToast('💾 ' + T('msg_saved'), 'ok');
    } catch (e) { showToast('❌ Erreur : ' + e.message, 'danger'); }
  }

  function loadConfigFromLocalStorage() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  function shareConfigUrl() {
    const url = generateShareUrl();
    if (!url) {
      const snap = snapshotForSave();
      if (snap) navigator.clipboard.writeText(JSON.stringify(snap))
        .then(() => showToast('📋 Config trop longue pour un lien. JSON copié.', 'warn'))
        .catch(() => showToast('⚠️ Config trop volumineuse pour un lien.', 'warn'));
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('🔗 Lien copié !', 'ok'))
        .catch(() => prompt('Copie ce lien :', url));
    } else prompt('Copie ce lien :', url);
  }

  return { snapshotForSave, restoreFromSnapshot, saveConfigToLocalStorage, loadConfigFromLocalStorage, shareConfigUrl };
}

window._createPersistenceHandlers = createPersistenceHandlers;
