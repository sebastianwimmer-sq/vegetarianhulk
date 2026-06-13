/* ============================================================
   vegetarianhulk · /newsletter · Seiten-Verhalten (kein Form-Submit)
   Das Signup selbst läuft über <vh-newsletter-form> (/newsletter-form.js),
   die SSoT für beide Seiten. Hier bleibt nur das seitenspezifische:
   Sticky-CTA-Sichtbarkeit, Reveal-on-Scroll, Variant-Klasse.
   ============================================================ */

(function () {
  'use strict';

  var LS_KEY = 'vegetarianhulk_newsletterSubscribed';

  // ── Variant class (?variant=hand|geo, default hand) ─
  function applyVariant() {
    var params = new URLSearchParams(window.location.search);
    var v = params.get('variant') || 'hand';
    document.body.classList.remove('variant-hand', 'variant-geo');
    document.body.classList.add('variant-' + v);
  }

  // ── Sticky-CTA visibility logic ─
  function setupStickyCta() {
    var cta = document.querySelector('.sticky-cta');
    if (!cta) return;
    var hero = document.querySelector('.hero');
    var repeat = document.querySelector('.repeat');
    var subscribed = false;
    try { subscribed = localStorage.getItem(LS_KEY) === 'true'; } catch (e) {}

    var params = new URLSearchParams(window.location.search);
    var ctaForced = params.get('cta');
    if (ctaForced === 'on') { cta.classList.add('is-visible'); return; }
    if (ctaForced === 'off' || subscribed) { cta.classList.remove('is-visible'); return; }

    var heroOut = false, formIn = false;
    function update() {
      if (heroOut && !formIn) cta.classList.add('is-visible');
      else cta.classList.remove('is-visible');
    }
    var ob1 = new IntersectionObserver(function (entries) {
      heroOut = !entries[0].isIntersecting;
      update();
    }, { threshold: 0.1 });
    if (hero) ob1.observe(hero);

    var ob2 = new IntersectionObserver(function (entries) {
      formIn = entries[0].isIntersecting;
      update();
    }, { threshold: 0.15 });
    if (repeat) ob2.observe(repeat);

    // Komponente meldet Erfolg → Sticky nie wieder zeigen
    document.addEventListener('vh:subscribed', function () {
      cta.classList.remove('is-visible');
    });
  }

  // ── Reveal-on-scroll ─
  function setupReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          ob.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { ob.observe(el); });
  }

  // ── Boot ─
  document.addEventListener('DOMContentLoaded', function () {
    applyVariant();
    setupReveal();
    setupStickyCta();
  });
})();
