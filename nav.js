/* ============================================================
   VH Floating Nav — Progressive Enhancement
   - Aktiv-Slot via location.pathname (aria-current)
   - Scroll-Auto-Hide (Reveal beim Hochscrollen)
   - Cursor-Signatur: nur Desktop-Pointer, aus bei Touch + reduced-motion
   Degradiert sauber: ohne JS bleibt die Nav voll funktional.
   ============================================================ */
(function () {
  'use strict';

  /* --- Nav-Markup (EINE Quelle für alle Seiten) ------------- */
  var NAV_HTML =
    '<nav class="vh-nav" aria-label="Hauptnavigation" data-vh-nav>' +
      '<a class="vh-nav__slot" href="/" data-slot="/" aria-label="Startseite"><span class="vh-nav__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/><path d="M10 19v-4h4v4"/></svg></span><span class="vh-nav__label">Start</span></a>' +
      '<a class="vh-nav__slot" href="/partner-picks/" data-slot="/partner-picks/" aria-label="Smash Partner &amp; Picks"><span class="vh-nav__icon" style="font-family:\'Playfair Display\',serif;font-size:14px;font-weight:600;letter-spacing:-0.5px;">P&amp;P</span><span class="vh-nav__label">Partner</span></a>' +
      '<a class="vh-nav__slot vh-nav__slot--center" href="/touren/" data-slot="/touren/" aria-label="Hulk Hikes — Wandertouren"><span class="vh-nav__icon"><svg viewBox="0 0 72 56" fill="none" aria-hidden="true"><defs><linearGradient id="vhMtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9457"/><stop offset="1" stop-color="#0f2a1a"/></linearGradient></defs><path d="M0 55 17 27l11 12 9-9 15 15 20-9v20z" fill="#347e4f" opacity="0.5"/><path d="M4 55 27 13l10 16 7-10 24 36z" fill="url(#vhMtn)"/><path d="M27 13l4.6 7.5-4.6 2.6-4.3-2.1z" fill="#f4ead4"/><path d="M44 19l3.3 5-3.3 1.9-3-1.5z" fill="#f4ead4"/><path d="M27 13 31 33" stroke="#0f2a1a" stroke-width="0.9" opacity="0.45"/></svg></span><span class="vh-nav__label">Hulk&nbsp;Hikes</span></a>' +
      '<a class="vh-nav__slot" href="/newsletter" data-slot="/newsletter" aria-label="Newsletter"><span class="vh-nav__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m3.6 7 8.4 6 8.4-6"/></svg></span><span class="vh-nav__label">News</span></a>' +
      '<a class="vh-nav__slot" href="/kooperationen.html" data-slot="/kooperationen.html" aria-label="Für Brands"><span class="vh-nav__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7.5" width="18" height="11.5" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/></svg></span><span class="vh-nav__label">Brands</span></a>' +
    '</nav>';

  /* Topbar → Brand-only machen + Floating-Nav injizieren (falls nicht da) */
  var topbar = document.querySelector('header.topbar');
  if (topbar) {
    topbar.classList.add('topbar--brandonly');
    var kill = topbar.querySelectorAll('.topbar-nav, .topbar-burger, .topbar-meta');
    for (var k = 0; k < kill.length; k++) kill[k].parentNode.removeChild(kill[k]);
  }
  if (!document.querySelector('[data-vh-nav]')) {
    var tmp = document.createElement('div');
    tmp.innerHTML = NAV_HTML;
    document.body.appendChild(tmp.firstElementChild);
  }

  var nav = document.querySelector('[data-vh-nav]');
  if (!nav) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* --- Aktiv-Slot markieren --------------------------------- */
  (function markActive() {
    var path = location.pathname.replace(/\/index\.html$/, '/');
    if (path === '') path = '/';
    var slots = nav.querySelectorAll('.vh-nav__slot');
    var best = null, bestLen = -1;
    slots.forEach(function (slot) {
      var target = slot.getAttribute('data-slot') || slot.getAttribute('href');
      slot.removeAttribute('aria-current');
      if (target === '/') {
        if (path === '/' && bestLen < 0) { best = slot; bestLen = 0; }
        return;
      }
      // längster Prefix-Match gewinnt (z.B. /touren/mordau-alm -> /touren/)
      if (path.indexOf(target) === 0 && target.length > bestLen) {
        best = slot; bestLen = target.length;
      }
    });
    if (best) best.setAttribute('aria-current', 'page');
  })();

  /* --- Logo per-Region-Invert: helle Klon-Ebene, auf dunkle Sektionen geclippt */
  (function regionInvert() {
    var brand = document.querySelector('.topbar--brandonly');
    var link = brand && brand.querySelector('.brand');
    if (!link) return;
    var darks = document.querySelectorAll('[data-nav-dark]');
    if (!darks.length) return;
    var layer = link.cloneNode(true);
    layer.classList.add('brand--invert-layer');
    layer.removeAttribute('href');
    layer.removeAttribute('id');
    layer.setAttribute('aria-hidden', 'true');
    brand.appendChild(layer);
    function update() {
      var r = link.getBoundingClientRect();
      var lo = r.right, hi = r.left, covered = false;
      for (var i = 0; i < darks.length; i++) {
        var d = darks[i].getBoundingClientRect();
        if (d.bottom <= r.top || d.top >= r.bottom) continue; // keine vertikale Überlappung
        var x1 = Math.max(r.left, d.left), x2 = Math.min(r.right, d.right);
        if (x2 <= x1) continue;
        lo = Math.min(lo, x1); hi = Math.max(hi, x2); covered = true;
      }
      layer.style.clipPath = covered
        ? 'inset(-6px ' + (r.right - hi) + 'px -6px ' + (lo - r.left) + 'px)'
        : 'inset(0 100% 0 0)';
    }
    var t = false;
    window.addEventListener('scroll', function () {
      if (!t) { window.requestAnimationFrame(function () { update(); t = false; }); t = true; }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();

  /* --- Scroll-Auto-Hide (nur Nav; Logo bleibt persistent) --- */
  if (!reduceMotion) {
    var lastY = window.pageYOffset;
    var ticking = false;
    var THRESHOLD = 8;
    function onScroll() {
      var y = window.pageYOffset;
      var dy = y - lastY;
      if (Math.abs(dy) > THRESHOLD) {
        // runter + genug gescrollt => Nav verstecken; hoch => zeigen
        nav.classList.toggle('is-hidden', dy > 0 && y > 120);
        lastY = y;
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
  }

  /* --- Cursor-Signatur (Desktop-Pointer only) --------------- */
  if (finePointer && !reduceMotion) {
    var cursor = document.createElement('div');
    cursor.className = 'vh-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    // Berg-Silhouette (Peak) statt Kreis
    cursor.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 20.5 9 8l3.2 5.4L15.5 7 22 20.5z"/></svg>';
    document.body.appendChild(cursor);

    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var rx = cx, ry = cy;
    var shown = false;
    var raf;

    function render() {
      // sanftes Nachziehen (ease)
      rx += (cx - rx) * 0.22;
      ry += (cy - ry) * 0.22;
      cursor.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      raf = window.requestAnimationFrame(render);
    }

    document.addEventListener('mousemove', function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!shown) { cursor.classList.add('is-visible'); shown = true; }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      cursor.classList.remove('is-visible'); shown = false;
    });

    // Magnetischer Zustand über interaktiven Elementen
    var MAGNET = 'a, button, .vh-nav__slot, [role="button"], input[type="submit"]';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(MAGNET)) cursor.classList.add('is-magnetic');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(MAGNET)) cursor.classList.remove('is-magnetic');
    });

    render();
  }
})();
