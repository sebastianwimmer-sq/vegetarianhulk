/* Ausgelagert aus kooperationen.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt. */
/* Count-Up der Stat-Zahlen beim Reinscrollen (animiert + live-Gefühl) */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmtInt(n) { return n.toLocaleString('de-DE'); }
  function fmtPct(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  var nums = document.querySelectorAll('[data-count], [data-count-pct]');
  function run(el) {
    var pct = el.hasAttribute('data-count-pct');
    var target = parseFloat(pct ? el.dataset.countPct : el.dataset.count);
    var fmt = pct ? fmtPct : fmtInt;
    if (reduce) { el.textContent = fmt(target); return; }
    var t0 = null, DUR = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(pct ? Math.round(target * e * 10) / 10 : Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && nums.length) {
    if (!reduce) nums.forEach(function (el) { el.textContent = el.hasAttribute('data-count-pct') ? fmtPct(0) : fmtInt(0); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    nums.forEach(function (el) { io.observe(el); });
  } else { nums.forEach(run); }
})();

/* Scroll-driven Ablauf — Etappen aktivieren beim Durchscrollen (IntersectionObserver) */
(function () {
  'use strict';
  var root = document.querySelector('[data-ablauf]');
  if (!root) return;
  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-step]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-panel]'));
  var fill = root.querySelector('[data-fill]');
  var n = panels.length;
  if (!n || steps.length !== n) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var maxSeen = 0, cur = -1;

  function setActive(i) {
    if (i === cur) return;
    cur = i;
    if (i > maxSeen) maxSeen = i;
    steps.forEach(function (s, k) {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-done', k <= maxSeen);
      s.setAttribute('aria-current', k === i ? 'step' : 'false');
    });
    panels.forEach(function (p, k) { p.classList.toggle('is-in', k === i); });
    if (fill) fill.style.setProperty('--fill', (maxSeen / (n - 1)).toFixed(4));
  }

  /* Node antippen → sanft zur Etappe scrollen (Tastatur-fähig) */
  steps.forEach(function (s, i) {
    s.addEventListener('click', function () {
      var id = s.getAttribute('data-target');
      var target = id && document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      else setActive(i);
    });
  });

  if (!('IntersectionObserver' in window)) {
    maxSeen = n - 1;
    panels.forEach(function (p) { p.classList.add('is-in'); });
    setActive(n - 1);
    return;
  }

  setActive(0);
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        var idx = panels.indexOf(en.target);
        if (idx > -1) setActive(idx);
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  panels.forEach(function (p) { io.observe(p); });
})();
