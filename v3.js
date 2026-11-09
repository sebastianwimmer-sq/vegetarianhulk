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
  /* Ein Licht fuer die ganze Seite (Runde 4, 09.11., Sebi: "alles so einzeln,
     mit dem Background so lose"): die Seite ist ein Tag am Berg. Oben kuehles
     Morgenlicht links, in der Mitte Gold von oben, am Ende Abendrot hinter
     dem Grat im Fuss. Alle Abschnitte stehen im selben Licht, das mit dem
     Scrollen wandert — keine Uhr, nur der Weg. */
  var LICHT = [
    { p: 0.00, x: 16, y: 6, r: 160, g: 230, b: 190, a: 0.12 },
    { p: 0.50, x: 56, y: 0, r: 240, g: 204, b: 140, a: 0.20 },
    { p: 1.00, x: 50, y: 100, r: 238, g: 150, b: 108, a: 0.24 }
  ];
  var wurzel = document.documentElement;
  function licht(p) {
    var i = p < LICHT[1].p ? 0 : 1, A = LICHT[i], B = LICHT[i + 1];
    var f = (p - A.p) / (B.p - A.p); f = f * f * (3 - 2 * f);
    function m(k) { return A[k] + (B[k] - A[k]) * f; }
    wurzel.style.setProperty('--licht-x', m('x').toFixed(1) + '%');
    wurzel.style.setProperty('--licht-y', m('y').toFixed(1) + '%');
    wurzel.style.setProperty('--licht-farbe', 'rgba(' + Math.round(m('r')) + ',' + Math.round(m('g')) + ',' + Math.round(m('b')) + ',' + m('a').toFixed(3) + ')');
  }
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    /* Landschafts-Durchfahrt: Ebene 1 faehrt ~104vh hoch (Abstieg),
       Ebene 2 laeuft gegenlaeufig langsamer — Zonen ziehen vorbei */
    var vh = window.innerHeight;
    a.style.transform = 'translateY(' + (-p * 1.04 * vh) + 'px)';
    b.style.transform = 'translateY(' + (p * 0.38 * vh) + 'px) rotate(' + (p * 5) + 'deg)';
    licht(p);
    t = false;
  }
  window.addEventListener('scroll', function () {
    if (!t) { requestAnimationFrame(update); t = true; }
  }, { passive: true });
  update();
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

/* Der echte Watzmann-Kamm, 72 Spalten, 0..1: je Spalte die hoechste Stelle
   aus watzmann-dem.json. Geteilt von Zitat-Szene und Fuss-Grat. */
var VH_KAMM = [0.893, 0.886, 0.859, 0.787, 0.731, 0.709, 0.697, 0.704, 0.758, 0.777, 0.814, 0.86,
  0.841, 0.83, 0.826, 0.806, 0.791, 0.782, 0.764, 0.752, 0.729, 0.708, 0.735, 0.774, 0.786, 0.788,
  0.781, 0.778, 0.775, 0.82, 0.875, 0.948, 1.0, 0.977, 0.973, 0.994, 0.979, 0.97, 0.958, 0.923,
  0.889, 0.837, 0.78, 0.762, 0.749, 0.747, 0.743, 0.736, 0.752, 0.798, 0.78, 0.718, 0.682, 0.632,
  0.591, 0.578, 0.591, 0.578, 0.562, 0.531, 0.489, 0.424, 0.404, 0.404, 0.414, 0.42, 0.419, 0.402,
  0.361, 0.335, 0.334, 0.315];

/* Zitat vor dem Watzmann im Morgenlicht (09.11.2026, Runde 3).
 *
 * WARUM
 * Sebi 09.11. mit Bildschirmfoto der Startseite: "beim Spruch alles so leer",
 * "macht noch keinen Spass weiter zu scrollen", "kein generischer KI-Slop,
 * nichts flach, high end". Gemeint war DIESES Zitat, nicht der Fuss.
 * Deshalb steht der Satz jetzt an einem Ort: hinter ihm der echte Kamm in
 * drei Ebenen (fern blass, nah dunkel), der beim Scrollen mit Tiefe aufsteigt,
 * dahinter geht das Licht auf und faengt sich am fernen Grat. Wenn das Licht
 * oben ist, gluehen die starken Woerter. Der nahe Kamm fuehrt in den 3D-Berg
 * darunter (relief3d.js) — Szene statt Absatz.
 * Kein Timer, kein Dauer-Frame: gezeichnet wird nur beim Scrollen, solange
 * das Zitat im Bild ist. Text bleibt immer voll lesbar. Reduzierte
 * Bewegung: Endbild ohne Versatz.
 */
(function () {
  'use strict';
  var quote = document.querySelector('.quote');
  if (!quote) return;
  var NS = 'http://www.w3.org/2000/svg';
  var B = 1000, H = 300;

  function kamm(u) {
    var x = Math.max(0, Math.min(1, u)) * (VH_KAMM.length - 1);
    var i = Math.min(VH_KAMM.length - 2, Math.floor(x)), f = x - i;
    return VH_KAMM[i] * (1 - f) + VH_KAMM[i + 1] * f;
  }
  /* je Ebene ein anderer Ausschnitt des Kamms, damit es eine Kette wird */
  function linie(von, bis, spiegel, oben, hub) {
    var d = '';
    for (var s = 0; s <= 120; s++) {
      var u = s / 120, k = kamm(von + (bis - von) * (spiegel ? 1 - u : u));
      d += (s ? 'L' : 'M') + (u * B).toFixed(1) + ' ' + (oben + (1 - k) * hub).toFixed(1);
    }
    return d;
  }
  var EBENEN = [
    { cls: 'zs-fern', d: linie(0.05, 0.95, true, 70, 120), weg: 18, farben: ['#8fb59a', '#4a7a60', '#2a5541'] },
    { cls: 'zs-mitte', d: linie(0.30, 1.00, false, 130, 110), weg: 46, farben: ['#3d7258', '#1d4a37', '#123a2c'] },
    { cls: 'zs-nah', d: linie(0.00, 0.62, false, 190, 90), weg: 84, farben: ['#1a4835', '#0a2a1e', '#06231a'] }
  ];

  var szene = document.createElement('div');
  szene.className = 'zitat-szene';
  szene.setAttribute('aria-hidden', 'true');
  var licht = document.createElement('div');
  licht.className = 'zs-licht';
  szene.appendChild(licht);
  var teile = EBENEN.map(function (e) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + B + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'zs-ebene ' + e.cls);
    /* Licht von hinten oben: Grat heller, Fuss im Dunst dunkler */
    var defs = document.createElementNS(NS, 'defs');
    var lg = document.createElementNS(NS, 'linearGradient');
    var gid = 'zs-' + e.cls;
    lg.setAttribute('id', gid);
    lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0'); lg.setAttribute('x2', '0'); lg.setAttribute('y2', '1');
    e.farben.forEach(function (fa, k) {
      var st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', String(k / (e.farben.length - 1)));
      st.setAttribute('stop-color', fa);
      lg.appendChild(st);
    });
    defs.appendChild(lg);
    svg.appendChild(defs);
    var f = document.createElementNS(NS, 'path');
    f.setAttribute('d', e.d + 'L' + B + ' ' + H + 'L0 ' + H + 'Z');
    f.setAttribute('class', 'zs-flaeche');
    f.setAttribute('fill', 'url(#' + gid + ')');
    svg.appendChild(f);
    if (e.cls === 'zs-fern') {
      var g = document.createElementNS(NS, 'path');
      g.setAttribute('d', e.d);
      g.setAttribute('class', 'zs-grat');
      g.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(g);
    }
    szene.appendChild(svg);
    return { el: svg, weg: e.weg };
  });
  quote.insertBefore(szene, quote.firstChild);
  quote.classList.add('hat-szene');

  var ss = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function setzen(q) {
    var rest = 1 - ss(q);
    teile.forEach(function (t) { t.el.style.transform = 'translate3d(0,' + (rest * t.weg).toFixed(1) + 'px,0)'; });
    licht.style.transform = 'translate3d(-50%,' + (rest * 70).toFixed(1) + 'px,0)';
    szene.style.setProperty('--licht', ss((q - 0.15) / 0.55).toFixed(3));
    if (q > 0.55) quote.classList.add('gluehen');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setzen(1); return; }

  function messen() {
    var vh = window.innerHeight, r = quote.getBoundingClientRect();
    setzen((vh - r.top) / Math.max(1, vh * 0.75 + r.height * 0.5));
  }
  var wartet = false, dran = false;
  function anstossen() {
    if (wartet) return;
    wartet = true;
    requestAnimationFrame(function () { wartet = false; messen(); });
  }
  function dabei(an) {
    if (an === dran) return;
    dran = an;
    window[an ? 'addEventListener' : 'removeEventListener']('scroll', anstossen, { passive: true });
    if (an) anstossen();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { dabei(es[0].isIntersecting); }, { rootMargin: '20% 0px' }).observe(quote);
  } else { dabei(true); }
  window.addEventListener('resize', anstossen, { passive: true });
  messen();
  window.addEventListener('beforeprint', function () { setzen(1); });
})();

/* Fuss-Grat: der Watzmann-Kamm als Ende jeder Seite (09.11.2026).
 *
 * WARUM
 * Sebi 08./09.11.: Partikel live animiert, Richtung B (Schneefahne am Grat),
 * "nicht zu viel", "das ganze Design-System fuer alle Seiten". Runde 2 am
 * selben Tag (als Fuss gelesen, gemeint waren Startseiten-Berg und -Zitat,
 * siehe Runde 3 im Zitat-Block und in relief3d.js): das Seitenende ist ein
 * Ankommen am Grat:
 *   EINGANG — die drei Kaemme steigen beim Scrollen von unten auf, der
 *     ferne langsamer als der nahe (Tiefe aus dem Scroll, kein Timer).
 *   GIPFEL  — oben angekommen tritt der Spruch hervor ("Disziplin ueber
 *     Hype." gross) und darunter Sebis Tag-Zaehler in Handschrift.
 *   BOEE    — dann zieht Schnee ueber den Grat: schwillt an, flaut ab
 *     (Boee 3,2 s + Ausklang < 1,4 s), danach kein Frame mehr. Maus oder
 *     Finger ueber dem Grat holt die naechste. Endet von selbst < 5 s,
 *     deshalb kein Halte-Knopf (WCAG 2.2.2).
 * Haengt am <footer>, den alle v3-Seiten teilen: keine Seite baut etwas
 * ein, DE und EN gleich. Reduzierte Bewegung: Grat steht oben, Spruch
 * sichtbar, kein Schnee.
 *
 * DIE LINIE ist der echte Kamm: je Spalte die hoechste Stelle aus
 * watzmann-dem.json (72 Spalten, 0..1); die 860-KB-Datei laedt hier nicht.
 * Neu rechnen: Maximum je Spalte ueber das auf 72 x 72 verkleinerte DEM. */
(function () {
  'use strict';
  var fuss = document.querySelector('body > footer');
  var inner = fuss && fuss.querySelector('.inner');
  if (!inner || !('getContext' in document.createElement('canvas'))) return;

  var KAMM = VH_KAMM;
  /* fern -> nah: Ausschnitt des Kamms, Hoehe, Fusslinie, Farbe, Schnee-
     Gewicht, Aufstieg (Anteil der Hoehe, um den die Ebene beim Eingang
     tiefer startet — nah weiter als fern, das ergibt die Parallaxe). */
  var EBENEN = [
    { von: 0.30, bis: 1.00, hub: 0.40, unten: 0.50, farbe: '#24503f', schnee: 0.35, steigt: 0.22 },
    { von: 0.12, bis: 0.86, hub: 0.46, unten: 0.68, farbe: '#123a2c', schnee: 0.6, steigt: 0.42 },
    { von: 0.00, bis: 1.00, hub: 0.52, unten: 0.86, farbe: '#06231A', schnee: 1, steigt: 0.66 }
  ];
  var SCHNEE = '243,235,217';      /* --paper */
  var BOEE_MS = 3200, ANSCHWELLEN_MS = 700, MAX_FLOCKEN = 240, OBEN_AB = 0.92;
  var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var en = document.documentElement.lang === 'en';

  /* Spruch teilen: "Builder & Creator." klein, "Disziplin ueber Hype." gross.
     Ohne Skript bleibt die eine Zeile wie bisher stehen. */
  var claim = inner.querySelector('.claim'), gipfel = null;
  var m = claim && claim.textContent.trim().match(/^(.+?\.)\s+(.+)$/);
  if (m) {
    claim.textContent = '';
    var klein = document.createElement('span'); klein.className = 'claim__vor'; klein.textContent = m[1];
    claim.appendChild(klein);
    /* Runde 4 (09.11., Sebi: der Satz "geht unten total unter"): der grosse
       Satz steht nicht mehr klein unter dem Kamm, sondern UEBER ihm im
       Himmel — Disziplin ueber Hype, waehrend der Schnee daran vorbeizieht. */
    gipfel = document.createElement('div'); gipfel.className = 'fuss-gipfel';
    var gross = document.createElement('p'); gross.className = 'claim__satz'; gross.textContent = m[2];
    var tag = document.createElement('p'); tag.className = 'fuss-tag';
    var zahl = document.createElement('span'); zahl.setAttribute('data-gb-tag', '');
    tag.appendChild(zahl); tag.appendChild(document.createTextNode(en ? ' vegetarian.' : ' vegetarisch.'));
    gipfel.appendChild(gross); gipfel.appendChild(tag);
  }

  var cv = document.createElement('canvas');
  cv.className = 'fuss-grat';
  cv.setAttribute('aria-hidden', 'true');
  fuss.insertBefore(cv, inner);
  if (gipfel) { fuss.insertBefore(gipfel, cv); fuss.classList.add('hat-gipfel'); }
  fuss.classList.add('hat-grat');
  var ctx = cv.getContext('2d');
  var w = 0, h = 0, oy = 0, h2 = 0, flocken = [], boee = 0, boeeStart = 0, wind = 1, laeuft = false, sichtbar = false;
  var aufstieg = ruhig ? 1 : 0, obenGewesen = false;

  function kamm(u) {
    var x = Math.max(0, Math.min(1, u)) * (KAMM.length - 1);
    var i = Math.min(KAMM.length - 2, Math.floor(x)), f = x - i;
    return KAMM[i] * (1 - f) + KAMM[i + 1] * f;
  }
  function weich(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function versatz(e) { return (1 - weich(aufstieg)) * h2 * EBENEN[e].steigt; }
  function gratY(e, x) {
    var E = EBENEN[e], u = E.von + (x / w) * (E.bis - E.von);
    return oy + h2 * E.unten - (kamm(u) - 0.3) / 0.7 * h2 * E.hub + versatz(e);
  }
  function messen() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    /* Himmel = Hoehe des Satzes darueber (CSS: --gipfel-h), der Kamm darunter */
    oy = gipfel ? Math.min(h * 0.6, gipfel.offsetHeight) : 0;
    h2 = h - oy;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function neueFlocke() {
    var e = Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 1 : 0;
    var x = Math.random() * w;
    return { e: e, x: x, y: gratY(e, x), vx: 0, vy: 0, alter: 0, leben: 60 + Math.random() * 70 };
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
        /* weich rein (erste 12 Bilder), weich raus (Lebensende) */
        var deck = Math.min(1, p.alter / 12) * Math.min(1, (1 - p.alter / p.leben) * 1.6);
        ctx.fillStyle = 'rgba(' + SCHNEE + ',' + (deck * (0.45 + EBENEN[e].schnee * 0.5)).toFixed(3) + ')';
        var r = 1.2 + EBENEN[e].schnee * 1.8;
        ctx.fillRect(p.x, p.y, r, r);
      }
    }
  }
  /* Boee als Huellkurve: anschwellen, halten, abflauen — kein harter Start. */
  function boeeStaerke(t) {
    var d = t - boeeStart;
    if (d >= BOEE_MS) return 0;
    return d < ANSCHWELLEN_MS ? weich(d / ANSCHWELLEN_MS) : 1 - weich((d - ANSCHWELLEN_MS) / (BOEE_MS - ANSCHWELLEN_MS));
  }
  function schritt(t) {
    if (!sichtbar || document.hidden) { laeuft = false; return; }
    boee = boeeStaerke(t);
    /* Dichte je Breite, nicht je Bild: am Handy sonst dreifach so dicht. */
    var neu = boee > 0 ? Math.round(boee * 8 * Math.min(1, w / 1440) + Math.random() * 0.6) : 0;
    while (neu-- > 0 && flocken.length < MAX_FLOCKEN * Math.min(1, w / 1200)) flocken.push(neueFlocke());
    flocken = flocken.filter(function (p) {
      var tiefe = 0.45 + EBENEN[p.e].schnee * 0.55;
      p.vx += (wind * (0.25 + boee) * tiefe - p.vx) * 0.08;
      p.vy += (-0.62 * tiefe - p.vy) * 0.05;
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

  /* EINGANG: Aufstieg 0..1 aus der Lage der Leinwand im Fenster. Bei 0
     beruehrt ihre Oberkante den unteren Rand, bei 1 steht ihre Mitte im
     unteren Drittel. Rueckwaerts scrollen laesst die Kaemme wieder sinken. */
  function aufstiegMessen() {
    var r = cv.getBoundingClientRect(), vh = window.innerHeight;
    var ziel = vh * 0.72 - r.height * 0.5;
    var a = (vh - r.top) / Math.max(1, vh - ziel);
    /* Seiten, die schon am Ende enden, bevor die Leinwand hoch genug kommt
       (kurze Seiten, grosses Fenster): dann gilt der Rest des Scrollwegs. */
    var rest = document.documentElement.scrollHeight - vh - window.scrollY;
    if (rest <= 2) a = 1;
    return Math.max(0, Math.min(1, a));
  }
  function scrollen() {
    if (ruhig) return;
    var a = aufstiegMessen();
    if (Math.abs(a - aufstieg) < 0.002) return;
    aufstieg = a;
    if (!laeuft) zeichnen();
    if (a >= OBEN_AB && !obenGewesen) { obenGewesen = true; fuss.classList.add('ist-oben'); boeeAusloesen(1.2); }
  }
  var geplant = false;
  function planen() { if (!geplant) { geplant = true; requestAnimationFrame(function () { geplant = false; scrollen(); }); } }

  function himmelSetzen() { if (gipfel) fuss.style.setProperty('--gipfel-h', gipfel.offsetHeight + 'px'); }
  himmelSetzen();
  messen();
  if (ruhig) fuss.classList.add('ist-oben');
  else aufstieg = aufstiegMessen();
  zeichnen();
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var alt = w; himmelSetzen(); messen(); if (w !== alt) flocken = []; zeichnen();
    }).observe(cv);
    if (gipfel) new ResizeObserver(function () { himmelSetzen(); }).observe(gipfel);
  }
  if (ruhig) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (eintraege) {
      sichtbar = eintraege[0].isIntersecting;
      if (sichtbar) planen();
    }).observe(cv);
  } else { sichtbar = true; }
  window.addEventListener('scroll', function () { if (sichtbar) planen(); }, { passive: true });
  window.addEventListener('resize', planen, { passive: true });
  scrollen();

  /* Maus: Staerke aus der Position (links leise, rechts kraeftig), hoechstens
     eine neue Boee je Sekunde. Finger: Tippen auf den Grat. */
  var letzte = 0;
  /* Am Dokument, nicht am Fuss: der Fuss laesst Zeiger durch (v3.css). */
  document.addEventListener('pointermove', function (ev) {
    if (ev.pointerType !== 'mouse' || !obenGewesen || !sichtbar) return;
    var r = cv.getBoundingClientRect();
    if (ev.clientY < r.top || ev.clientY > r.bottom || performance.now() - letzte < 1000) return;
    letzte = performance.now();
    boeeAusloesen(0.6 + (ev.clientX - r.left) / r.width * 1.4);
  }, { passive: true });
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse' || !sichtbar) return;
    var r = cv.getBoundingClientRect();
    if (ev.clientY >= r.top && ev.clientY <= r.bottom) boeeAusloesen(1.4);
  }, { passive: true });
})();

/* Gipfelbuch: heutiges Datum + Tag-Zaehler (vegetarisch seit 2016) */
(function () {
  'use strict';
  var d = document.querySelector('[data-gb-datum]');
  /* Alle Zaehler: Gipfelbuch (Startseite) und Fuss (jede Seite, legt der
     Fuss-Grat oben an — deshalb steht dieser Block nach ihm). */
  var tage = document.querySelectorAll('[data-gb-tag]');
  if (d) d.textContent = new Date().toLocaleDateString(document.documentElement.lang === 'en' ? 'en-US' : 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  if (tage.length) {
    var days = Math.floor((Date.now() - new Date(2016, 7, 15).getTime()) / 86400000);  /* Veggie-Start: 15.08.2016 (Sebi) */
    // Englische Seiten (/en/): Day 3,800 statt Tag 3.800
    var txt = document.documentElement.lang === 'en' ? 'Day ' + days.toLocaleString('en-US') : 'Tag ' + days.toLocaleString('de-DE');
    tage.forEach(function (t) { t.textContent = txt; });
  }
})();
