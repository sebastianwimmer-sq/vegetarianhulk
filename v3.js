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

/* Nav: steht fest — Handy unten, Desktop oben, nie beim Scrollen wechselnd (28.09.2026). Bis dahin fuhr sie am
   Desktop zwischen Kopf und Fuss hin und her — 785 px quer ueber den Schirm bei
   jedem Verlassen des Seitenkopfs und bei jedem Seitenwechsel, in WebKit mit
   einem Sprung beim Laden. Keine Schwelle, keine Hysterese und kein Easing hat
   das behoben (#49, #50), weil die Fahrt selbst der Fehler war. Am Handy stand
   die Leiste schon immer fest und war nie auffaellig. Tor: scripts/nav-check.mjs. */

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

  /* SICHERHEITSNETZ. Gemessen am 22.09.2026: beim schnellen Durchscrollen
     blieben Abschnitte ohne `.in` zurueck — einer lag 4.130 px oberhalb der
     Fensterkante und war nie aufgedeckt worden. Der Beobachter verschluckt
     bei grossen Scrollspruengen Eintraege, und `io.unobserve` sorgt dafuer,
     dass es keine zweite Gelegenheit gibt.

     (Die Live-Seite selbst war NICHT betroffen — ein erster Messlauf sah so
     aus, hatte aber nur zu kurz gewartet. Der Grund fuer dieses Netz ist der
     verschluckte Eintrag, nicht ein Ausfall in Produktion.)

     Ein Einblenden, das Inhalt verstecken KANN, ist ein stiller Ausfall: der
     Beobachter meldet nichts, die Konsole bleibt still, und gemerkt haette es
     nur ein Besucher. Deshalb deckt dieses Netz alles auf, was im Dokument
     schon oberhalb der Fensterunterkante liegt — unabhaengig davon, ob der
     Beobachter ausgeloest hat.

     Das Netz ersetzt den Beobachter nicht (der macht die Staffelung), es
     faengt nur seine Aussetzer. Es laeuft gedrosselt und hoert auf, sobald
     nichts mehr offen ist. */
  function netz() {
    var offen = 0;
    els.forEach(function (e) {
      if (e.classList.contains('in')) return;
      if (e.getBoundingClientRect().top < window.innerHeight) { e.classList.add('in'); io.unobserve(e); }
      else offen++;
    });
    return offen;
  }
  var wartet = false;
  function anstossen() {
    if (wartet) return;
    wartet = true;
    requestAnimationFrame(function () { wartet = false; if (!netz()) abmelden(); });
  }
  function abmelden() {
    window.removeEventListener('scroll', anstossen);
    window.removeEventListener('resize', anstossen);
  }
  window.addEventListener('scroll', anstossen, { passive: true });
  window.addEventListener('resize', anstossen, { passive: true });
  window.addEventListener('load', anstossen);
  /* Letzter Halt: was nach dem Laden immer noch zu ist, aber im Dokument
     laengst passiert waere, wird sichtbar. Lieber ohne Effekt als unlesbar. */
  setTimeout(netz, 2500);
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
