/* VH v3 — Verhalten (Nav-Morph, Reveals, Altimeter, Invert) */
/* Load-Choreografie */
(function () {
  'use strict';

  /* Druck: Lazy-Bilder laden erst beim Scrollen — wer druckt, scrollt nicht,
     und die Fotos waeren im PDF leere Kaesten (motion-loop 06.10.2026). */
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('img[loading="lazy"]').forEach(function (i) { i.loading = 'eager'; });
  });
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
  /* Die Zahl wird ueber ihren Ort gefunden, nicht ueber ein Attribut: der
     Rail-Markup steht kopiert auf 15 Seiten, und auf fuenf davon war `data-hm`
     beim Kopieren verloren gegangen — dort stand die Zahl fest (28.09.2026). */
  var hms = document.querySelectorAll('.rail-peak .hm, [data-hm]');
  if (!peaks.length) return;
  var t = false;
  function update() {
    t = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    var hm = (2713 - Math.round(p * 2713)) + ' hm';
    peaks.forEach(function (el) {
      var h = el.parentNode.clientHeight;
      el.style.setProperty('--p', p);
      el.style.setProperty('--y', Math.round(h * (0.10 + 0.78 * p)) + 'px');
    });
    hms.forEach(function (el) { if (el.textContent !== hm) el.textContent = hm; });
  }
  function planen() { if (!t) { t = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', planen, { passive: true });
  window.addEventListener('resize', planen, { passive: true });
  /* Waechst die Seite nach dem Laden (Bilder, aufklappende Zeilen), stimmt der
     Anteil sonst erst beim naechsten Scrollen wieder. */
  if ('ResizeObserver' in window) new ResizeObserver(planen).observe(document.body);
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
  if (d) d.textContent = new Date().toLocaleDateString(document.documentElement.lang === 'en' ? 'en-US' : 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  if (t) {
    var days = Math.floor((Date.now() - new Date(2016, 7, 15).getTime()) / 86400000);  /* Veggie-Start: 15.08.2016 (Sebi) */
    // Englische Seiten (/en/): Day 3,800 statt Tag 3.800
    t.textContent = document.documentElement.lang === 'en' ? 'Day ' + days.toLocaleString('en-US') : 'Tag ' + days.toLocaleString('de-DE');
  }
})();

/* Fuss-Grat: Schneefahne am Watzmann-Kamm ueber jedem Seitenfuss (09.11.2026).
 *
 * WARUM
 * Sebi 08./09.11.: Partikel live animiert auf der Website, Richtung B
 * (Schneefahne am Grat) gewaehlt, "nicht zu viel" und "das ganze Design-
 * System fuer alle Seiten". Deshalb EIN Baustein an EINER Stelle: jede Seite
 * endet am Grat. Er haengt am <footer>, den alle v3-Seiten teilen — keine
 * Seite muss etwas einbauen, DE und EN bekommen ihn gleich.
 *
 * NICHT ZU VIEL
 * Keine Dauerschleife: kommt der Fuss ins Bild, zieht eine Boee ueber den
 * Grat (Boee 3,2 s + Ausklang < 1,4 s), danach steht alles still und die Leinwand zeichnet nichts
 * mehr. Maus oder Finger ueber dem Grat holt die naechste Boee. Endet von
 * selbst unter 5 s, deshalb braucht es keinen Halte-Knopf (WCAG 2.2.2).
 * Reduzierte Bewegung: nur der stehende Grat, kein Schnee.
 *
 * DIE LINIE ist der echte Kamm: je Spalte die hoechste Stelle aus
 * watzmann-dem.json (72 Spalten, 0..1). Die Datei selbst ist 860 KB und
 * wird hier nicht geladen. Neu rechnen: Maximum je Spalte ueber das auf
 * 72 x 72 verkleinerte DEM. Drei Ebenen: fern blass wie Dunst, nah in der
 * Farbe des Seitengrunds; nach unten loest die Maske in v3.css den Grat
 * in den Grund auf (unten liegt je Seite ein anderes Licht). */
(function () {
  'use strict';
  var fuss = document.querySelector('body > footer');
  if (!fuss || !('getContext' in document.createElement('canvas'))) return;

  var KAMM = [0.893, 0.886, 0.859, 0.787, 0.731, 0.709, 0.697, 0.704, 0.758, 0.777, 0.814, 0.86,
    0.841, 0.83, 0.826, 0.806, 0.791, 0.782, 0.764, 0.752, 0.729, 0.708, 0.735, 0.774, 0.786, 0.788,
    0.781, 0.778, 0.775, 0.82, 0.875, 0.948, 1.0, 0.977, 0.973, 0.994, 0.979, 0.97, 0.958, 0.923,
    0.889, 0.837, 0.78, 0.762, 0.749, 0.747, 0.743, 0.736, 0.752, 0.798, 0.78, 0.718, 0.682, 0.632,
    0.591, 0.578, 0.591, 0.578, 0.562, 0.531, 0.489, 0.424, 0.404, 0.404, 0.414, 0.42, 0.419, 0.402,
    0.361, 0.335, 0.334, 0.315];
  /* fern -> nah: Ausschnitt des Kamms, Hoehe, Anhebung, Farbe */
  var EBENEN = [
    { von: 0.30, bis: 1.00, hub: 0.46, unten: 0.62, farbe: '#24503f', schnee: 0.35 },
    { von: 0.12, bis: 0.86, hub: 0.52, unten: 0.80, farbe: '#123a2c', schnee: 0.6 },
    { von: 0.00, bis: 1.00, hub: 0.58, unten: 1.00, farbe: '#06231A', schnee: 1 }
  ];
  var SCHNEE = '243,235,217';      /* --paper */
  var BOEE_MS = 3200, MAX_FLOCKEN = 240;
  var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cv = document.createElement('canvas');
  cv.className = 'fuss-grat';
  cv.setAttribute('aria-hidden', 'true');
  fuss.insertBefore(cv, fuss.firstChild);
  var ctx = cv.getContext('2d');
  var w = 0, h = 0, flocken = [], boee = 0, boeeStart = 0, wind = 1, laeuft = false, sichtbar = false;

  function kamm(u) {
    var x = Math.max(0, Math.min(1, u)) * (KAMM.length - 1);
    var i = Math.min(KAMM.length - 2, Math.floor(x)), f = x - i;
    return KAMM[i] * (1 - f) + KAMM[i + 1] * f;
  }
  function gratY(e, x) {
    var E = EBENEN[e], u = E.von + (x / w) * (E.bis - E.von);
    return h * E.unten - (kamm(u) - 0.3) / 0.7 * h * E.hub;
  }
  function messen() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function neueFlocke() {
    var e = Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 1 : 0;
    var x = Math.random() * w;
    return { e: e, x: x, y: gratY(e, x), vx: 0, vy: 0, alter: 0, leben: 40 + Math.random() * 40 };
  }
  function zeichnen() {
    ctx.clearRect(0, 0, w, h);
    for (var e = 0; e < EBENEN.length; e++) {
      ctx.fillStyle = EBENEN[e].farbe;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (var x = 0; x <= w + 4; x += 4) ctx.lineTo(x, gratY(e, x));
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      for (var i = 0; i < flocken.length; i++) {
        var p = flocken[i];
        if (p.e !== e) continue;
        var rest = 1 - p.alter / p.leben;
        ctx.fillStyle = 'rgba(' + SCHNEE + ',' + (Math.min(1, rest * 1.6) * (0.35 + EBENEN[e].schnee * 0.5)).toFixed(3) + ')';
        var r = 0.9 + EBENEN[e].schnee * 1.3;
        ctx.fillRect(p.x, p.y, r, r);
      }
    }
  }
  function schritt(t) {
    if (!sichtbar || document.hidden) { laeuft = false; return; }
    boee = Math.max(0, 1 - (t - boeeStart) / BOEE_MS);
    /* Dichte je Breite, nicht je Bild: am Handy sonst dreifach so dicht. */
    var neu = boee > 0 ? Math.round(boee * 6 * Math.min(1, w / 1440) + Math.random() * 0.6) : 0;
    while (neu-- > 0 && flocken.length < MAX_FLOCKEN * Math.min(1, w / 1200)) flocken.push(neueFlocke());
    flocken = flocken.filter(function (p) {
      var tiefe = 0.45 + EBENEN[p.e].schnee * 0.55;
      p.vx += (wind * (0.25 + boee) * tiefe - p.vx) * 0.08;
      p.vy += (-0.35 * tiefe - p.vy) * 0.05;
      p.x += p.vx * 1.6; p.y += p.vy + Math.sin((p.alter + p.x) * 0.05) * 0.3;
      p.alter++;
      return p.alter < p.leben && p.x < w + 8;
    });
    zeichnen();
    if (boee > 0 || flocken.length) requestAnimationFrame(schritt);
    else laeuft = false;
  }
  function boeeAusloesen(staerke) {
    if (ruhig) return;
    wind = staerke;
    boeeStart = performance.now();
    if (!laeuft && sichtbar) { laeuft = true; requestAnimationFrame(schritt); }
  }

  messen(); zeichnen();
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var alt = w; messen(); if (w !== alt) flocken = []; zeichnen();
    }).observe(cv);
  }
  if (ruhig) return;

  var schonGeweht = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (eintraege) {
      sichtbar = eintraege[0].isIntersecting;
      if (sichtbar && !schonGeweht) { schonGeweht = true; boeeAusloesen(1.2); }
    }, { threshold: 0.35 }).observe(cv);
  }
  /* Maus: Staerke aus der Position (links leise, rechts kraeftig), hoechstens
     eine neue Boee je Sekunde. Finger: Tippen auf den Grat. */
  var letzte = 0;
  fuss.addEventListener('pointermove', function (ev) {
    if (ev.pointerType !== 'mouse') return;
    var r = cv.getBoundingClientRect();
    if (ev.clientY > r.bottom || performance.now() - letzte < 1000) return;
    letzte = performance.now();
    boeeAusloesen(0.6 + (ev.clientX - r.left) / r.width * 1.4);
  }, { passive: true });
  fuss.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse') return;
    var r = cv.getBoundingClientRect();
    if (ev.clientY <= r.bottom) boeeAusloesen(1.4);
  }, { passive: true });
})();
