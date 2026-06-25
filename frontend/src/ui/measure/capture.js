// ============================================================
// ui/measure/capture.js — Flux caméra arrière + capture JPEG
// ============================================================
//
// Couche caméra (effets de bord). getUserMedia caméra arrière,
// puis capture d'une trame compressée en JPEG (qualité 0.6) via
// canvas.toBlob — prête à être stockée en local (IndexedDB, phase 4).
// ============================================================

/**
 * @returns {boolean} true si getUserMedia est disponible.
 */
export function cameraSupported() {
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

/**
 * Démarre la caméra arrière (facingMode "environment") dans un <video>.
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function startRearCamera(videoEl) {
  const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', '');
  videoEl.muted = true;
  try {
    await videoEl.play();
  } catch {
    /* certains navigateurs exigent un geste — ignoré */
  }
  return stream;
}

/**
 * Stoppe toutes les pistes d'un MediaStream.
 * @param {MediaStream|null} stream
 */
export function stopStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
}

/**
 * Capture la trame courante du <video> et la compresse en JPEG.
 * Largeur bornée (maxW) pour limiter le poids.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} [quality=0.6]
 * @param {number} [maxW=1280]
 * @returns {Promise<{blob:Blob|null, dataUrl:string|null, width:number, height:number}>}
 */
export function captureFrame(videoEl, quality = 0.6, maxW = 1280) {
  return new Promise((resolve) => {
    const vw = videoEl.videoWidth || maxW;
    const vh = videoEl.videoHeight || Math.round((maxW * 9) / 16);
    const scale = vw > maxW ? maxW / vw : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const done = (blob, dataUrl) =>
      resolve({ blob, dataUrl, width: canvas.width, height: canvas.height });
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => done(blob, null), 'image/jpeg', quality);
    } else {
      done(null, canvas.toDataURL('image/jpeg', quality));
    }
  });
}
