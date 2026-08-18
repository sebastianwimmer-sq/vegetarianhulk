/* VH v3 — Verhalten (Nav-Morph, Reveals, Altimeter, Invert) */
/* Load-Choreografie */
(function () {
  'use strict';
  function go() { requestAnimationFrame(function () { document.body.classList.add('loaded'); }); }
  // Früh + zuverlässig: sobald DOM geparst ist (nicht erst nach allen Bildern).
  if (document.readyState !== 'loading') go();
  else document.addEventListener('DOMContentLoaded', go);
  // Sicherheitsnetz: falls etwas hakt, spätestens nach 2,5 s alles sichtbar machen.
  setTimeout(go, 2500);
})();

/* Wordmark-Invert über hellen Inseln */
(function () {
  'use strict';
  var base = document.querySelector('.brandbox .wordmark:not(.wordmark--invert)');
  var layer = document.querySelector('[data-invert-layer]');
  if (!base || !layer) return;
  var lights = document.querySelectorAll('[data-light]');
  function update() {
    var r = base.getBoundingClientRect();
    var lo = r.right, hi = r.left, covered = false;
    for (var i = 0; i < lights.length; i++) {
      var d = lights[i].getBoundingClientRect();
      if (d.bottom <= r.top || d.top >= r.bottom) continue;
      var x1 = Math.max(r.left, d.left), x2 = Math.min(r.right, d.right);
      if (x2 <= x1) continue;
      lo = Math.min(lo, x1); hi = Math.max(hi, x2); covered = true;
    }
    layer.style.clipPath = covered
      ? 'inset(-4px ' + (r.right - hi) + 'px -4px ' + (lo - r.left) + 'px)'
      : 'inset(0 100% 0 0)';
  }
  var t = false;
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(function () { update(); t = false; }); t = true; }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* Lava-Parallax: Lichtzonen wandern beim Scrollen (nur transform) */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var a = document.querySelector('.bg-wrap');
  var b = document.querySelector('.bg2-wrap');
  if (!a || !b) return;
  var t = false;
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    /* Landschafts-Durchfahrt: Ebene 1 faehrt ~104vh hoch (Abstieg),
       Ebene 2 laeuft gegenlaeufig langsamer — Zonen ziehen vorbei */
    var vh = window.innerHeight;
    a.style.transform = 'translateY(' + (-p * 1.04 * vh) + 'px)';
    b.style.transform = 'translateY(' + (p * 0.38 * vh) + 'px) rotate(' + (p * 5) + 'deg)';
    t = false;
  }
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(update); t = true; }
  }, { passive: true });
})();

/* Nav-Morph: oben normale Zeile, ab Scroll wird sie zur Bottom-Pille */
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  if (!nav) return;
  var mq = window.matchMedia('(min-width: 900px)');
  var t = false;
  var isTop = null, busy = false;
  function update() {
    t = false;
    var want = mq.matches && window.scrollY < 120;
    if (want === isTop || busy) return;
    if (isTop === null) { isTop = want; nav.classList.toggle('at-top', want); return; }
    isTop = want; busy = true;
    nav.classList.add('nav-out');
    setTimeout(function () {
      nav.classList.add('no-t', 'pre');
      nav.classList.toggle('at-top', want);
      void nav.offsetWidth;
      nav.classList.remove('no-t');
      nav.classList.remove('pre', 'nav-out');
      setTimeout(function () { busy = false; update(); }, 500);
    }, 210);
  }
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(update); t = true; }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* Wordmark weicht beim Runterscrollen, kommt beim Hochscrollen zurück */
(function () {
  'use strict';
  var bar = document.querySelector('.topbar');
  if (!bar) return;
  var lastY = window.scrollY, t = false;
  function update() {
    var y = window.scrollY;
    if (y > lastY + 4 && y > 180) bar.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 180) bar.classList.remove('is-hidden');
    lastY = y; t = false;
  }
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(update); t = true; }
  }, { passive: true });
})();

/* Altimeter: Scroll-Fortschritt = Aufstieg (0 -> 2962 hm, Zugspitze) */
(function () {
  'use strict';
  var peaks = document.querySelectorAll('.rail-peak');
  var hms = document.querySelectorAll('[data-hm]');
  if (!peaks.length) return;
  var t = false;
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    var hm = 2713 - Math.round(p * 2713);
    peaks.forEach(function (el) { el.style.setProperty('--p', p); });
    hms.forEach(function (el) { el.textContent = hm + ' hm'; });
    t = false;
  }
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(update); t = true; }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* Scroll-Entry mit Stagger */
(function () {
  'use strict';
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -4% 0px' }); /* war -10%: bei schnellem Scroll wirkten Sektionen als Lücke */
  els.forEach(function (e) { io.observe(e); });
})();

/* Gipfelbuch: heutiges Datum + Tag-Zaehler (vegetarisch seit 2016) */
(function () {
  'use strict';
  var d = document.querySelector('[data-gb-datum]');
  var t = document.querySelector('[data-gb-tag]');
  if (d) d.textContent = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  if (t) {
    var days = Math.floor((Date.now() - new Date(2016, 7, 15).getTime()) / 86400000);  /* Veggie-Start: 15.08.2016 (Sebi) */
    t.textContent = 'Tag ' + days.toLocaleString('de-DE');
  }
})();
