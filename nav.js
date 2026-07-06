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

  /* --- Scroll-Auto-Hide (Nav + Brand-Chip synchron) --------- */
  if (!reduceMotion) {
    var brand = document.querySelector('.topbar--brandonly');
    var lastY = window.pageYOffset;
    var ticking = false;
    var THRESHOLD = 8;
    function onScroll() {
      var y = window.pageYOffset;
      var dy = y - lastY;
      if (Math.abs(dy) > THRESHOLD) {
        // runter + genug gescrollt => verstecken; hoch => zeigen
        var hide = dy > 0 && y > 120;
        nav.classList.toggle('is-hidden', hide);
        if (brand) brand.classList.toggle('is-hidden', hide);
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
