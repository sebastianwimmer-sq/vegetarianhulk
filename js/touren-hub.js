/* Ausgelagert aus touren/index.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt. */
/* Hulk-Hikes Forum-Liste: Suche · Filter · Sortierung · Expand */
(function () {
  'use strict';
  var list = document.getElementById('tkList');
  if (!list) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('.tk-row'));
  var search = document.getElementById('tkSearch');
  var sortSel = document.getElementById('tkSort');
  var countEl = document.getElementById('tkCount');
  var empty = document.getElementById('tkEmpty');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.tk-chip'));
  var state = { q: '', region: '', diff: '', sort: 'new' };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Expand/Collapse */
  rows.forEach(function (row) {
    var head = row.querySelector('.tk-row__head');
    head.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var open = row.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  function match(row) {
    if (state.region && row.dataset.region !== state.region) return false;
    if (state.diff && row.dataset.diff !== state.diff) return false;
    if (state.q && row.dataset.name.indexOf(state.q) === -1) return false;
    return true;
  }

  function apply() {
    /* sortieren */
    var sorted = rows.slice().sort(function (a, b) {
      switch (state.sort) {
        case 'old': return (+a.dataset.date) - (+b.dataset.date);
        case 'easy': return (+a.dataset.thm) - (+b.dataset.thm);
        case 'hard': case 'hm': return (+b.dataset.thm) - (+a.dataset.thm);
        default: return (+b.dataset.date) - (+a.dataset.date); /* new */
      }
    });
    sorted.forEach(function (r) { list.appendChild(r); });

    /* filtern mit sanfter Ausblendung */
    var shown = 0;
    rows.forEach(function (r) {
      var ok = match(r);
      if (ok) shown++;
      if (reduce) { r.hidden = !ok; r.classList.toggle('is-out', !ok); return; }
      if (!ok && !r.hidden) {
        r.classList.add('is-out');
        setTimeout(function () { if (r.classList.contains('is-out')) r.hidden = true; }, 280);
      } else if (ok) {
        r.hidden = false;
        requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.remove('is-out'); }); });
      }
    });
    countEl.textContent = shown;
    empty.style.display = shown ? 'none' : 'block';
  }

  /* Suche (debounced) */
  var t;
  search.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      state.q = search.value.trim().toLowerCase();
      apply();
    }, 140);
  });

  /* Filter-Chips */
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.f, v = chip.dataset.v;
      state[f] = v;
      chips.forEach(function (c) {
        if (c.dataset.f === f) c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
      });
      apply();
    });
  });

  sortSel.addEventListener('change', function () { state.sort = sortSel.value; apply(); });

  document.getElementById('tkReset').addEventListener('click', function () {
    state = { q: '', region: '', diff: '', sort: state.sort };
    search.value = '';
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.v === '' ? 'true' : 'false'); });
    apply();
  });

  apply();
})();

/* Abschluss: Count-up-Bilanz + Live-Bedingungen (Open-Meteo, Revier Schneizlreuth) */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nums = document.querySelectorAll('[data-count]');
  function fmt(n) { return n.toLocaleString('de-DE'); }
  function run(el) {
    var target = parseInt(el.dataset.count, 10);
    if (reduce) { el.textContent = fmt(target); return; }
    var t0 = null, DUR = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && nums.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    nums.forEach(function (el) { io.observe(el); });
  } else { nums.forEach(function (el) { el.textContent = fmt(parseInt(el.dataset.count, 10)); }); }

  var box = document.querySelector('[data-tklive]');
  if (box && window.fetch) {
    var WMO = function (cd) { return cd === 0 ? 'klar' : cd <= 2 ? 'leicht bewölkt' : cd === 3 ? 'bedeckt'
      : cd <= 48 ? 'Nebel' : cd <= 67 ? 'Regen' : cd <= 77 ? 'Schneefall' : cd <= 82 ? 'Schauer' : 'Gewitter'; };
    var IC = {
      sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/>',
      suncloud: '<circle cx="8.4" cy="8.2" r="3.4"/><path d="M8.4 2.6v1.8M2.8 8.2h1.8M4.4 4.2l1.3 1.3"/><path d="M8.6 18.4h8.9a3.1 3.1 0 0 0 .4-6.2 4.6 4.6 0 0 0-9-.9 3.6 3.6 0 0 0-.3 7.1z"/>',
      cloud: '<path d="M7.4 18.2h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/>',
      fog: '<path d="M4 9.6h16M4 13h13M6 16.4h12M8 19.8h9"/>',
      rain: '<path d="M7.4 14.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M8.6 17.4l-1 2.6M12.6 17.4l-1 2.6M16.6 17.4l-1 2.6"/>',
      snow: '<path d="M7.4 14.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M8.4 18.4h.01M12.2 20h.01M16 18.4h.01" stroke-linecap="round" stroke-width="2.1"/>',
      storm: '<path d="M7.4 13.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M12.8 15l-2.4 3.4h3l-2.2 3.4"/>'
    };
    var key = function (cd) { return cd === 0 ? 'sun' : cd <= 2 ? 'suncloud' : cd === 3 ? 'cloud'
      : cd <= 48 ? 'fog' : cd <= 67 ? 'rain' : cd <= 77 ? 'snow' : cd <= 82 ? 'rain' : 'storm'; };
    fetch('https://api.open-meteo.com/v1/forecast?latitude=47.65&longitude=12.79&elevation=1200&current=temperature_2m,weather_code&daily=sunset&timezone=Europe%2FBerlin&forecast_days=1')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        var s = (d.daily.sunset[0] || '').slice(11, 16);
        box.querySelector('[data-lv-temp]').textContent = Math.round(d.current.temperature_2m);
        box.querySelector('[data-lv-cond]').textContent = WMO(d.current.weather_code);
        box.querySelector('[data-lv-ico]').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">' + IC[key(d.current.weather_code)] + '</svg>';
        box.querySelector('[data-lv-meta]').textContent = 'Chiemgau/BGL · ~1.200 m' + (s ? ' · Licht bis ' + s : '');
        box.hidden = false;
      })
      .catch(function () {});
  }
})();
