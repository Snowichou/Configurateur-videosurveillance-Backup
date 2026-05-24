/**
 * handlers/quote.js — Actions commerciales (devis + partage distributeur)
 * PH4.4d — extrait de app.js
 *
 * Exports (factory):
 *   createQuoteHandlers(deps) => { requestQuote, sendToDistributor }
 *
 * deps: { MODEL, getLastProject, getCameraById, T, showToast, generateShareUrl }
 */

export function createQuoteHandlers(deps = {}) {
  const { MODEL, getLastProject, getCameraById, T, showToast, generateShareUrl } = deps;

  function requestQuote() {
    const proj = getLastProject();
    if (!proj) { showToast("⚠️ Finalise ta configuration d'abord.", 'warn'); return; }
    const subject = encodeURIComponent("Demande de devis — " + (MODEL.projectName || 'Projet vidéosurveillance'));
    const cams = (MODEL.cameraLines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
    const nvrId = proj.nvrPick?.nvr?.id || '—';
    const camDetails = (MODEL.cameraLines || []).map(l => {
      const cam = typeof getCameraById === 'function' ? getCameraById(l.cameraId) : null;
      return (l.qty || 1) + '× ' + (cam?.id || l.cameraId) + ' — ' + (cam?.name || '');
    }).join('\n');
    const body = encodeURIComponent(
      'Bonjour,\n\n' +
      "Je souhaite obtenir un devis pour la configuration suivante :\n\n" +
      '━━━ PROJET ━━━\n' +
      'Nom : ' + (MODEL.projectName || '—') + '\n' +
      T('proj_site_type_label') + ' : ' + (MODEL.projectUseCase || '—') + '\n\n' +
      '━━━ CAMÉRAS (' + cams + ') ━━━\n' +
      camDetails + '\n\n' +
      '━━━ ENREGISTREMENT ━━━\n' +
      'NVR : ' + nvrId + '\n' +
      T('pdf_required_storage') + ' : ' + (proj.requiredTB?.toFixed(1) || '—') + ' To\n' +
      'Codec : ' + (MODEL.recording?.codec || 'h265').toUpperCase() + ' • ' + (MODEL.recording?.fps || 25) + ' FPS\n' +
      'Rétention : ' + (MODEL.recording?.daysRetention || 30) + ' jours\n\n' +
      '━━━ RÉSEAU ━━━\n' +
      'Débit total : ' + (proj.totalInMbps?.toFixed(1) || '—') + ' Mbps\n\n' +
      'Merci de me recontacter avec une proposition chiffrée.\n' +
      'Le PDF de configuration est disponible en pièce jointe.\n\n' +
      'Cordialement'
    );
    window.open('mailto:devis@comelit.fr?subject=' + subject + '&body=' + body, '_blank');
    showToast("✉️ Email pré-rempli ouvert vers devis@comelit.fr", 'ok');
  }

  function sendToDistributor() {
    const url = generateShareUrl();
    if (navigator.share) {
      navigator.share({ title: 'Configuration Comelit — ' + (MODEL.projectName || ''), url: url || window.location.href })
        .then(() => showToast('✅ Partagé !', 'ok')).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).then(() => showToast('🔗 Lien copié — transmets-le à ton distributeur.', 'ok'))
        .catch(() => prompt('Copie ce lien :', url));
    } else showToast("⚠️ Génère le PDF et envoie-le par email.", 'warn');
  }

  return { requestQuote, sendToDistributor };
}

window._createQuoteHandlers = createQuoteHandlers;
