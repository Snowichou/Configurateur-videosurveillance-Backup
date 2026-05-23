/* ════════════════════════════════════════════════════════════════════════
 * TOOLTIP FIX — Configurateur Comelit
 *
 * Le CSS actuel utilise .infoTip::after avec content: attr(data-tip),
 * mais les containers parents (.recoCard, .card) ont overflow: hidden,
 * ce qui tronque la bulle.
 *
 * Ce script remplace le système par un tooltip "porté" attaché au <body>
 * qui n'est jamais limité par un parent. Il suit la souris du .infoTip
 * survolé.
 *
 * À inclure DANS LE HTML après app.js :
 *   <script src="tooltip-fix.js" defer></script>
 * ════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Inject styles & disable native ::after tooltip ──────────────────
  const css = `
    /* Disable the native CSS-only tooltip (overflow:hidden parent breaks it) */
    .infoTip::after, .infoTip::before { display: none !important; }

    /* Floating tooltip (portaled to <body>) */
    .ctTooltip{
      position: fixed;
      z-index: 9999;
      max-width: 300px;
      padding: 9px 13px;
      background: #1C1F2A;
      color: #fff;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.45;
      letter-spacing: -0.005em;
      border-radius: 8px;
      box-shadow:
        0 8px 24px rgba(28,31,42,.25),
        0 2px 6px rgba(28,31,42,.15);
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity .15s ease, transform .15s ease;
      text-align: left;
    }
    .ctTooltip.is-visible{
      opacity: 1;
      transform: translateY(0);
    }

    /* Arrow */
    .ctTooltip::after{
      content: "";
      position: absolute;
      width: 0; height: 0;
      border: 5px solid transparent;
    }
    .ctTooltip[data-side="top"]::after{
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: #1C1F2A;
    }
    .ctTooltip[data-side="bottom"]::after{
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: #1C1F2A;
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── Single shared tooltip element ───────────────────────────────────
  let tip = null;
  function getTip() {
    if (tip && tip.isConnected) return tip;
    tip = document.createElement('div');
    tip.className = 'ctTooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    return tip;
  }

  // ─── Position the tooltip relative to a target element ───────────────
  function positionTip(target) {
    const t = getTip();
    const r = target.getBoundingClientRect();
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const margin = 10; // gap between target and tooltip

    // Default : place above
    let side = 'top';
    let top = r.top - th - margin;
    let left = r.left + r.width / 2 - tw / 2;

    // If not enough space above, flip below
    if (top < 8) {
      side = 'bottom';
      top = r.bottom + margin;
    }

    // Clamp horizontally inside viewport
    const minLeft = 8;
    const maxLeft = window.innerWidth - tw - 8;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    t.style.top = `${top}px`;
    t.style.left = `${left}px`;
    t.dataset.side = side;
  }

  // ─── Show / hide ─────────────────────────────────────────────────────
  let activeTarget = null;

  function show(target) {
    const text = target.dataset.tip || target.getAttribute('title') || '';
    if (!text) return;

    // Move title→data-tip once and remove title to avoid native browser tooltip
    if (target.hasAttribute('title') && !target.dataset.tip) {
      target.dataset.tip = target.getAttribute('title');
      target.removeAttribute('title');
    }

    activeTarget = target;
    const t = getTip();
    t.textContent = text;
    // Force layout to compute size
    positionTip(target);
    requestAnimationFrame(() => {
      t.classList.add('is-visible');
    });
  }

  function hide() {
    if (!tip) return;
    tip.classList.remove('is-visible');
    activeTarget = null;
  }

  // ─── Event delegation : works for dynamically rendered .infoTip ──────
  document.addEventListener('mouseover', function (e) {
    const target = e.target.closest('.infoTip');
    if (!target) return;
    if (target === activeTarget) return;
    show(target);
  });

  document.addEventListener('mouseout', function (e) {
    const target = e.target.closest('.infoTip');
    if (!target) return;
    // Hide only if leaving the .infoTip (not bubbling from inner)
    const related = e.relatedTarget;
    if (related && target.contains(related)) return;
    hide();
  });

  // Touch / focus support
  document.addEventListener('focusin', function (e) {
    const target = e.target.closest('.infoTip');
    if (!target) return;
    show(target);
  });
  document.addEventListener('focusout', function (e) {
    const target = e.target.closest('.infoTip');
    if (!target) return;
    hide();
  });

  // Click toggle on touch devices
  document.addEventListener('click', function (e) {
    const target = e.target.closest('.infoTip');
    if (!target) {
      hide();
      return;
    }
    if (activeTarget === target) {
      hide();
    } else {
      show(target);
    }
  });

  // Hide on scroll/resize so tooltip doesn't drift
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
})();
