/* ============================================================
   vegetarianhulk · Motion-Reveal-System v31.10
   ----------------------------------------------------------
   Single IntersectionObserver für alle .reveal Elemente.
   Once-only reveal (kein Repeat beim Scroll-Up).
   Stagger via --reveal-delay Custom-Property pro Element.
   prefers-reduced-motion: instant-active, kein Animation.
   ============================================================ */
(function () {
  'use strict';

  var els = document.querySelectorAll('.reveal, .reveal-hero, .reveal-subtle');
  if (!els.length) return;

  // Fallback: no IO → activate all instantly
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('reveal-active'); });
    return;
  }

  // prefers-reduced-motion → instant-active, kein Observer-Overhead
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(function (el) { el.classList.add('reveal-active'); });
    return;
  }

  var ob = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('reveal-active');
        ob.unobserve(e.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  els.forEach(function (el) { ob.observe(el); });
})();
