// ============================================================
// ui/measure/modal.js — Modale "Mesurer la distance par photo + gyroscope"
// ============================================================
//
// Orchestre les couches capteur (gyro.js) et caméra (capture.js)
// autour de la trigonométrie pure (engine/measure-distance.js).
//
// Flux :
//   1. L'installateur se place à l'emplacement caméra, saisit/confirme
//      la hauteur de montage.
//   2. Il incline le téléphone vers la zone au sol → l'angle de plongée
//      est lu en direct et converti en distance horizontale.
//   3. Il capture la photo (preuve visuelle, JPEG compressé) puis valide.
//   4. onResult({ distanceM, heightM, blob }) est appelé.
//
// Robustesse (phase 6) :
//   - Permission gyro/caméra refusée  → saisie manuelle de la distance.
//   - Gyroscope/caméra non supportés  → saisie manuelle.
//   - Angle ≈ 0° / vers le haut       → message d'aide, pas de distance.
//   - Paysage / portrait              → géré via depressionFromOrientation.
//   - Nettoyage systématique (stream + listeners) à la fermeture.
//
// API : openMeasureModal({ heightM, T, onResult }) -> void
// ============================================================

import { measureFromPhone } from '../../engine/measure-distance.js';
import {
  gyroSupported,
  requestGyroPermission,
  subscribeOrientation,
} from './gyro.js';
import {
  cameraSupported,
  startRearCamera,
  stopStream,
  captureFrame,
} from './capture.js';

const REASON_MSG = {
  no_angle: 'En attente du gyroscope…',
  pointing_up: 'Inclinez le téléphone vers le sol (zone à surveiller).',
  angle_too_small: 'Angle trop proche de l’horizon — inclinez davantage vers le bas.',
  invalid_height: 'Saisissez d’abord la hauteur de montage.',
  clamped_max: 'Distance supérieure à 999 m (valeur bornée).',
};

/**
 * Ouvre la modale de mesure.
 * @param {Object} opts
 * @param {number|string} [opts.heightM] - hauteur de montage pré-remplie (m)
 * @param {(key:string)=>string} [opts.T] - i18n (optionnel)
 * @param {(res:{distanceM:number, heightM:number, blob:Blob|null})=>void} opts.onResult
 */
export function openMeasureModal({ heightM = '', T = (k) => k, onResult } = {}) {
  // ── État interne ────────────────────────────────────────
  let stream = null;
  let unsubGyro = null;
  let lastDistance = null;
  let lastHeight = Number(heightM) > 0 ? Number(heightM) : null;
  let capturedBlob = null;
  let lastTick = 0;

  const hasCamera = cameraSupported();
  const hasGyro = gyroSupported();

  // ── Construction DOM ────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'measureOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);' +
    'display:flex;align-items:center;justify-content:center;padding:14px;';

  overlay.innerHTML = `
    <div class="measurePanel" style="
        width:100%;max-width:460px;max-height:94vh;overflow:auto;
        background:var(--panel2,#161a20);color:var(--text,#e8eef5);
        border:1px solid var(--line,#2a3240);border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong style="font-size:16px">📷 Mesurer la distance</strong>
        <button type="button" data-mx="close" aria-label="Fermer" style="
          background:transparent;border:0;color:var(--text,#e8eef5);font-size:22px;
          line-height:1;cursor:pointer;padding:4px 8px">✕</button>
      </div>

      <label style="display:block;font-size:13px;margin-bottom:4px">
        🔧 Hauteur de montage de la caméra (m)
      </label>
      <input data-mx="height" type="number" min="0.1" max="50" step="0.1"
        value="${lastHeight ?? ''}" placeholder="Ex: 2.5" inputmode="decimal"
        style="width:100%;padding:9px;border-radius:10px;border:1px solid var(--line,#2a3240);
        background:var(--panel,#0f1217);color:var(--text,#e8eef5);margin-bottom:12px" />

      <div data-mx="camWrap" style="position:relative;border-radius:12px;overflow:hidden;
        background:#000;aspect-ratio:3/4;margin-bottom:10px;display:${hasCamera ? 'block' : 'none'}">
        <video data-mx="video" playsinline muted style="width:100%;height:100%;object-fit:cover;display:block"></video>
        <img data-mx="shot" alt="" style="display:none;width:100%;height:100%;object-fit:cover;position:absolute;inset:0" />
        <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
          <div style="width:2px;height:46%;background:rgba(0,188,112,.85)"></div>
          <div style="position:absolute;width:46%;height:2px;background:rgba(0,188,112,.5)"></div>
        </div>
        <div data-mx="readout" style="position:absolute;left:0;right:0;bottom:0;
          background:linear-gradient(transparent,rgba(0,0,0,.7));padding:10px 12px;font-size:13px"></div>
      </div>

      <div data-mx="readoutNoCam" style="display:${hasCamera ? 'none' : 'block'};
        background:var(--panel,#0f1217);border:1px solid var(--line,#2a3240);border-radius:10px;
        padding:10px;font-size:13px;margin-bottom:10px"></div>

      <div data-mx="manualWrap" style="display:none;margin-bottom:10px">
        <label style="display:block;font-size:13px;margin-bottom:4px">📏 Distance (saisie manuelle, m)</label>
        <input data-mx="manual" type="number" min="1" max="999" step="1" inputmode="numeric"
          placeholder="Ex: 15" style="width:100%;padding:9px;border-radius:10px;
          border:1px solid var(--line,#2a3240);background:var(--panel,#0f1217);color:var(--text,#e8eef5)" />
      </div>

      <div data-mx="hint" style="font-size:12px;opacity:.75;margin-bottom:12px;min-height:16px"></div>

      <div style="display:flex;gap:8px">
        <button type="button" data-mx="capture" style="flex:1;padding:11px;border-radius:11px;border:0;
          background:var(--brand,#00BC70);color:#fff;font-weight:600;cursor:pointer">📸 Capturer</button>
        <button type="button" data-mx="confirm" style="flex:1;padding:11px;border-radius:11px;border:0;
          background:var(--brand,#00BC70);color:#fff;font-weight:600;cursor:pointer;display:none">✅ Utiliser</button>
        <button type="button" data-mx="cancel" style="padding:11px 14px;border-radius:11px;
          border:1px solid var(--line,#2a3240);background:transparent;color:var(--text,#e8eef5);cursor:pointer">Annuler</button>
      </div>
    </div>`;

  const q = (sel) => overlay.querySelector(`[data-mx="${sel}"]`);
  const els = {
    height: q('height'),
    video: q('video'),
    shot: q('shot'),
    readout: q('readout'),
    readoutNoCam: q('readoutNoCam'),
    manualWrap: q('manualWrap'),
    manual: q('manual'),
    hint: q('hint'),
    capture: q('capture'),
    confirm: q('confirm'),
    cancel: q('cancel'),
    close: q('close'),
  };

  // ── Helpers ─────────────────────────────────────────────
  function setReadout(html) {
    if (hasCamera) els.readout.innerHTML = html;
    else els.readoutNoCam.innerHTML = html;
  }

  function showManual(reasonHint) {
    els.manualWrap.style.display = 'block';
    if (reasonHint) els.hint.textContent = reasonHint;
    // En mode manuel, "Capturer" devient inutile pour la distance.
    els.capture.style.display = 'none';
    els.confirm.style.display = 'block';
    els.confirm.textContent = '✅ Utiliser';
  }

  function cleanup() {
    if (unsubGyro) {
      try { unsubGyro(); } catch { /* ignore */ }
      unsubGyro = null;
    }
    stopStream(stream);
    stream = null;
  }

  function close() {
    cleanup();
    overlay.remove();
    window.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function currentHeight() {
    const v = Number(els.height.value);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // ── Boucle de lecture live (gyro) ───────────────────────
  function onOrientation(data) {
    const now = Date.now();
    if (now - lastTick < 90) return; // throttle ~11 Hz
    lastTick = now;

    const h = currentHeight();
    const { distanceM, depressionDeg, reason } = measureFromPhone({
      heightM: h,
      beta: data.beta,
      gamma: data.gamma,
      orientation: data.orientation,
    });

    lastDistance = distanceM;
    lastHeight = h;

    const angleStr =
      Number.isFinite(depressionDeg) ? `${Math.max(0, Math.round(depressionDeg))}°` : '—';

    if (distanceM != null && (reason === null || reason === 'clamped_max')) {
      setReadout(
        `<strong style="font-size:18px">≈ ${distanceM} m</strong>` +
          `<span style="opacity:.8"> &nbsp;·&nbsp; plongée ${angleStr}</span>` +
          (reason === 'clamped_max' ? `<div style="opacity:.8">${REASON_MSG.clamped_max}</div>` : '')
      );
      els.capture.disabled = false;
      els.capture.style.opacity = '1';
    } else {
      setReadout(
        `<span style="opacity:.85">plongée ${angleStr}</span>` +
          `<div style="opacity:.8">${REASON_MSG[reason] || ''}</div>`
      );
      els.capture.disabled = true;
      els.capture.style.opacity = '.5';
    }
  }

  // ── Actions ─────────────────────────────────────────────
  els.close.addEventListener('click', close);
  els.cancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  els.height.addEventListener('input', () => {
    // Recalcule immédiatement si aucun flux gyro n'a encore tické.
    if (!hasGyro) updateManualHint();
  });

  function updateManualHint() {
    const h = currentHeight();
    if (!h) els.hint.textContent = REASON_MSG.invalid_height;
    else els.hint.textContent = '';
  }

  // Capture : fige la trame + verrouille la distance courante.
  els.capture.addEventListener('click', async () => {
    const h = currentHeight();
    if (!h) {
      els.hint.textContent = REASON_MSG.invalid_height;
      return;
    }
    if (lastDistance == null) {
      els.hint.textContent = 'Visez la zone au sol pour obtenir une distance.';
      return;
    }
    if (hasCamera && els.video.srcObject) {
      try {
        const { blob, dataUrl } = await captureFrame(els.video, 0.6);
        capturedBlob = blob;
        const url = blob ? URL.createObjectURL(blob) : dataUrl;
        if (url) {
          els.shot.src = url;
          els.shot.style.display = 'block';
          els.video.style.display = 'none';
        }
      } catch {
        /* capture échouée : on garde quand même la distance */
      }
    }
    // Fige le flux gyro pour ne plus bouger la valeur.
    if (unsubGyro) { try { unsubGyro(); } catch { /* ignore */ } unsubGyro = null; }
    els.capture.style.display = 'none';
    els.confirm.style.display = 'block';
    els.confirm.textContent = `✅ Utiliser ≈ ${lastDistance} m`;
    els.hint.textContent = 'Photo capturée. Validez ou annulez pour reprendre.';
  });

  // Confirmation : renvoie le résultat.
  els.confirm.addEventListener('click', () => {
    const h = currentHeight();
    let distanceM = lastDistance;
    // Mode manuel : la distance vient de l'input dédié.
    if (els.manualWrap.style.display !== 'none' && els.manual.value) {
      const m = Math.round(Number(els.manual.value));
      if (Number.isFinite(m) && m > 0) distanceM = Math.min(999, m);
    }
    if (distanceM == null || !(distanceM > 0)) {
      els.hint.textContent = 'Aucune distance valide à enregistrer.';
      return;
    }
    if (typeof onResult === 'function') {
      onResult({ distanceM, heightM: h, blob: capturedBlob });
    }
    close();
  });

  // ── Montage + démarrage ─────────────────────────────────
  document.body.appendChild(overlay);
  window.addEventListener('keydown', onKey);

  async function boot() {
    // Caméra (optionnelle) — l'échec ne bloque pas la mesure gyro.
    if (hasCamera) {
      try {
        stream = await startRearCamera(els.video);
      } catch {
        const wrap = q('camWrap');
        if (wrap) wrap.style.display = 'none';
        els.readoutNoCam.style.display = 'block';
        els.hint.textContent = 'Caméra indisponible — mesure par gyroscope uniquement.';
      }
    }

    // Gyroscope.
    if (!hasGyro) {
      showManual('Gyroscope non disponible sur cet appareil — saisie manuelle.');
      updateManualHint();
      return;
    }
    const granted = await requestGyroPermission();
    if (!granted) {
      showManual('Permission gyroscope refusée — saisie manuelle.');
      updateManualHint();
      return;
    }
    setReadout('En attente du gyroscope…');
    unsubGyro = subscribeOrientation(onOrientation);

    // Filet de sécurité : si aucun événement n'arrive (~2,5 s) → manuel.
    setTimeout(() => {
      if (lastTick === 0 && unsubGyro) {
        showManual('Aucune donnée gyroscope reçue — saisie manuelle.');
      }
    }, 2500);
  }

  boot();
}
