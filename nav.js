/* ============================================================
   VH Floating Nav — Progressive Enhancement
   - Aktiv-Slot via location.pathname (aria-current)
   - Scroll-Auto-Hide (Reveal beim Hochscrollen)
   - Cursor-Signatur: nur Desktop-Pointer, aus bei Touch + reduced-motion
   Degradiert sauber: ohne JS bleibt die Nav voll funktional.
   ============================================================ */
(function () {
  'use strict';
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
