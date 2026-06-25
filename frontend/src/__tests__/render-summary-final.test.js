// ============================================================
// Tests render/summary-final.js — Indicateur "distance mesurée" (P5)
// ============================================================
//
// Vérifie que la photo/mesure DORI est surfacée dans le récap final :
// badge 📷 + distance lorsque le bloc porte answers.hasPhoto.
// ============================================================

import { describe, it, expect } from 'vitest';
import { renderFinalSummaryPure } from '../render/summary-final.js';

function makeDeps({ hasPhoto = false, distance = '15', label = 'Entrée' } = {}) {
  const cam = { id: 'CAM1', name: 'Caméra Test' };
  return {
    T: (k) => k,
    safeHtml: (s) => String(s),
    getThumbSrc: () => '',
    getCameraById: (id) => (id === 'CAM1' ? cam : null),
    getSelectedOrRecommendedEnclosure: () => ({ selected: null }),
    getSelectedOrRecommendedScreen: () => ({ selected: null }),
    getSelectedOrRecommendedSign: () => ({ selected: null }),
    computeCriticalProjectScore: () => null,
    MODEL: {
      cameraLines: [{ cameraId: 'CAM1', fromBlockId: 'B1', qty: 2 }],
      cameraBlocks: [
        {
          id: 'B1',
          label,
          answers: { distance_m: distance, hasPhoto: hasPhoto ? '1' : undefined },
        },
      ],
      accessoryLines: [],
    },
  };
}

describe('renderFinalSummaryPure — indicateur de mesure', () => {
  it('affiche 📷 + distance quand hasPhoto est présent', () => {
    const html = renderFinalSummaryPure({}, makeDeps({ hasPhoto: true, distance: '15' }));
    expect(html).toContain('📷');
    expect(html).toContain('15 m mesurés');
    expect(html).toContain('Entrée'); // le libellé du bloc reste présent
  });

  it('pas d’indicateur 📷 sans hasPhoto', () => {
    const html = renderFinalSummaryPure({}, makeDeps({ hasPhoto: false }));
    expect(html).not.toContain('📷');
  });
});
