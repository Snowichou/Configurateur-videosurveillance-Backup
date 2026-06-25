// ============================================================
// ui/measure/gyro.js — Accès gyroscope (DeviceOrientationEvent)
// ============================================================
//
// Couche capteur (effets de bord). La trigonométrie reste pure
// dans engine/measure-distance.js. Ce module se contente de :
//   - détecter le support du gyroscope
//   - demander la permission iOS (DeviceOrientationEvent.requestPermission)
//   - lire l'orientation écran (portrait / paysage)
//   - s'abonner au flux d'orientation
// ============================================================

/**
 * @returns {boolean} true si l'API DeviceOrientation existe.
 */
export function gyroSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/**
 * iOS 13+ exige une permission explicite déclenchée par un geste
 * utilisateur. Sur les autres plateformes, aucun prompt n'est requis.
 * @returns {Promise<boolean>} true si l'accès est accordé (ou non requis).
 */
export async function requestGyroPermission() {
  if (!gyroSupported()) return false;
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      const res = await DOE.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Lit le type d'orientation écran courant.
 * @returns {string} "portrait" | "landscape" (ou type natif type "landscape-primary")
 */
export function getScreenOrientation() {
  try {
    const t = window.screen && window.screen.orientation && window.screen.orientation.type;
    if (t) return t;
  } catch {
    /* ignore */
  }
  const a = typeof window.orientation === 'number' ? window.orientation : 0;
  return Math.abs(a) === 90 ? 'landscape' : 'portrait';
}

/**
 * S'abonne au flux d'orientation appareil.
 * @param {(data:{beta:number,gamma:number,alpha:number,orientation:string})=>void} cb
 * @returns {() => void} fonction de désabonnement
 */
export function subscribeOrientation(cb) {
  const handler = (e) => {
    cb({
      beta: e.beta,
      gamma: e.gamma,
      alpha: e.alpha,
      orientation: getScreenOrientation(),
    });
  };
  window.addEventListener('deviceorientation', handler, true);
  return () => window.removeEventListener('deviceorientation', handler, true);
}
