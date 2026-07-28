/* ============================================================
   VegetarianHulk — Launch-Gate (atmosphärischer Countdown + Reveal)
   Selbst-enthalten. SYNCHRON im <head> einbinden (KEIN defer/async):
       <script src="/launch-gate.js"></script>
   - Vor LAUNCH_TS: Vollbild-Szene (Berg-Silhouetten, Licht-Partikel,
     atmender Glow, Countdown, Signup). Seite verborgen, kein Flash.
   - Impressum/Datenschutz (ALLOWLIST): nie gesperrt.
   - Vorschau: ?vorschau=<PREVIEW_SECRET> → Bypass · ?vorschau=aus → Gate wieder an.
   - Ab LAUNCH_TS / bei 0: Reveal-Animation → echte Seite.
   - Fail-open: jeder Fehler → Seite zeigt normal.
   ============================================================ */
(function () {
  'use strict';
  try {
    /* ===================== CONFIG (nur hier ändern) ===================== */
    var LAUNCH_TS = Date.parse('2026-08-11T18:00:00+02:00'); // ⏰ PLATZHALTER — Wunsch-Datum
    var PREVIEW_SECRET = 'bergauf2026';                       // 🔑 ?vorschau=bergauf2026
    var ALLOWLIST = ['/impressum.html', '/datenschutz.html'];
    var LAUNCH_LABEL = '11. August 2026, 18:00';
    var NL_ENDPOINT = 'https://peaking-ai-api.peaking.workers.dev/newsletter/subscribe';
    /* =================================================================== */

    if (!LAUNCH_TS) return;

    var path = location.pathname;
    var normPath = path.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    var qs; try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
    if (qs && qs.get('vorschau')) {
      var vp = qs.get('vorschau');
      try { (vp === 'aus' || vp === 'off') ? localStorage.removeItem('vhLaunchPreview') : localStorage.setItem('vhLaunchPreview', vp); } catch (e) {}
    }
    var isPreview = false;
    try { isPreview = localStorage.getItem('vhLaunchPreview') === PREVIEW_SECRET; } catch (e) {}
    var allowed = ALLOWLIST.indexOf(path) !== -1 || ALLOWLIST.indexOf(normPath) !== -1;
    if (Date.now() >= LAUNCH_TS || isPreview || allowed) return;

    // ---- Sofort verbergen (kein Flash) ----
    var hide = document.createElement('style');
    hide.id = 'lg-hide';
    hide.textContent = 'html{background:#06120C}body>*{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hide);

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var raf = null;

    function build() {
      if (document.getElementById('lg-overlay')) return;

      var st = document.createElement('style');
      st.textContent = [
        '#lg-overlay{position:fixed;inset:0;z-index:2147483647;overflow:hidden;',
        'background-color:#07160E;background-image:linear-gradient(178deg,#0E3A22 0%,#0B2A1A 34%,#08190F 66%,#050F09 100%);',
        'font-family:\'Inter\',-apple-system,Helvetica,Arial,sans-serif;color:#EDE4CF}',
        // atmender Glow
        '#lg-glow{position:absolute;left:50%;top:-14%;width:120%;height:70%;transform:translateX(-50%);pointer-events:none;',
        'background:radial-gradient(50% 60% at 50% 40%,rgba(126,208,155,.20),rgba(126,208,155,0) 70%);',
        'animation:lgBreath 9s ease-in-out infinite}',
        '@keyframes lgBreath{0%,100%{opacity:.6;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.12)}}',
        // Partikel-Canvas
        '#lg-fx{position:absolute;inset:0;pointer-events:none;opacity:.9}',
        // Berg-Silhouetten
        '.lg-mtns{position:absolute;left:0;right:0;bottom:0;height:46vh;min-height:280px;pointer-events:none}',
        '.lg-mtns svg{position:absolute;left:0;bottom:0;width:100%;height:100%}',
        '.lg-mtns .far{opacity:.55}.lg-mtns .mid{opacity:.8}.lg-mtns .near{opacity:1}',
        '.lg-mtns .drift{animation:lgDrift 26s ease-in-out infinite alternate}',
        '@keyframes lgDrift{from{transform:translateX(-1.4%)}to{transform:translateX(1.4%)}}',
        // Content
        '.lg-core{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'text-align:center;padding:30px 22px;overflow:auto}',
        '.lg-core>*{opacity:0;transform:translateY(16px);animation:lgUp .9s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgUp{to{opacity:1;transform:none}}',
        '.lg-wm{font-size:14px;font-weight:700;letter-spacing:.36em;color:#F3EBD9;animation-delay:.05s}',
        '.lg-wm b{color:#7ED09B}',
        '.lg-mk{width:54px;height:39px;margin:24px 0 16px;color:#7ED09B;animation-delay:.15s;filter:drop-shadow(0 6px 20px rgba(126,208,155,.35))}',
        '.lg-mk path{stroke-dasharray:190;stroke-dashoffset:190;animation:lgDraw 1.5s cubic-bezier(.16,1,.3,1) .4s forwards}',
        '@keyframes lgDraw{to{stroke-dashoffset:0}}',
        '.lg-eye{font-size:11px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#D8B24A;animation-delay:.25s}',
        '.lg-h1{margin:14px 0 0;font-family:\'Playfair Display\',Georgia,serif;font-weight:700;font-size:clamp(34px,7vw,66px);',
        'line-height:1.02;letter-spacing:-.6px;color:#F5EEDD;text-shadow:0 4px 40px rgba(0,0,0,.5);animation-delay:.3s}',
        '.lg-h1 em{font-style:italic;color:#7ED09B}',
        '.lg-story{margin:16px 0 0;font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:clamp(15px,2.2vw,18px);color:#A7C0AD;animation-delay:.4s}',
        '.lg-cd{display:flex;gap:clamp(12px,3.4vw,30px);margin:30px 0 4px;animation-delay:.5s}',
        '.lg-cd .u{min-width:56px}',
        '.lg-cd .n{font-family:\'Playfair Display\',Georgia,serif;font-weight:700;font-size:clamp(36px,8.4vw,66px);line-height:1;color:#F5EEDD}',
        '.lg-cd .l{margin-top:9px;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#8FB79C}',
        '.lg-when{margin-top:12px;font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:14px;color:#7E9184;animation-delay:.55s}',
        '.lg-sub{margin:24px 0 0;font-size:15px;line-height:1.6;color:#DDE5DB;max-width:34ch;animation-delay:.62s}',
        '.lg-form{margin:16px auto 0;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:400px;width:100%;animation-delay:.7s}',
        '.lg-form input{flex:1;min-width:190px;padding:14px 16px;border-radius:11px;border:1px solid rgba(126,208,155,.3);',
        'background:rgba(6,20,13,.55);color:#F3EBD9;font-size:15px;font-family:inherit}',
        '.lg-form input::placeholder{color:#7E9184}.lg-form input:focus{outline:2px solid #7ED09B;outline-offset:1px}',
        '.lg-form button{padding:14px 26px;border:0;border-radius:11px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;',
        'letter-spacing:.06em;text-transform:uppercase;color:#14100A;background-image:linear-gradient(180deg,#F6D24A,#E4B824 55%,#C6980F);',
        'box-shadow:0 12px 26px -8px rgba(230,184,36,.5);transition:transform .2s}',
        '.lg-form button:hover{transform:translateY(-2px)}',
        '.lg-note{margin-top:12px;font-size:12px;color:#9FB6A4;animation-delay:.76s}.lg-note a{color:#7ED09B;text-decoration:none;font-weight:700}',
        '.lg-foot{margin-top:26px;font-size:11.5px;color:#5E7267;animation-delay:.82s}.lg-foot a{color:#8FB79C;text-decoration:none}',
        // Reveal
        'html.lg-reveal #lg-overlay{animation:lgOut 1.3s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgOut{40%{opacity:1}to{opacity:0;transform:translateY(-6%) scale(1.05);visibility:hidden}}',
        'html.lg-reveal .lg-mtns{animation:lgMtnUp 1.3s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgMtnUp{to{transform:translateY(60%)}}',
        'html.lg-reveal #lg-flare{opacity:1}',
        '#lg-flare{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .5s;',
        'background:radial-gradient(60% 50% at 50% 46%,rgba(246,226,180,.5),rgba(126,208,155,.12) 40%,transparent 72%)}',
        '@media (prefers-reduced-motion:reduce){#lg-glow,.lg-mtns .drift,.lg-core>*{animation:none!important;opacity:1!important;transform:none!important}.lg-mk path{stroke-dashoffset:0}}'
      ].join('');
      document.head.appendChild(st);

      var ov = document.createElement('div');
      ov.id = 'lg-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', 'VegetarianHulk — bald live');
      ov.innerHTML =
        '<div id="lg-glow"></div>' +
        '<canvas id="lg-fx"></canvas>' +
        '<div class="lg-mtns">' +
          '<svg class="far drift" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true"><path fill="#0C3320" d="M0 400V250l160-70 150 40 170-95 160 70 180-60 150 55 170-80 150 60V400z"/></svg>' +
          '<svg class="mid drift" style="animation-direction:alternate-reverse" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true"><path fill="#082014" d="M0 400V300l190-95 160 80 150-60 200 90 160-70 180 75 240-110V400z"/></svg>' +
          '<svg class="near" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true"><path fill="#05100A" d="M0 400V330l220-110 180 95 210-85 190 100 210-70 230 90V400z"/><path fill="none" stroke="rgba(126,208,155,.22)" stroke-width="2" d="M0 330l220-110 180 95"/></svg>' +
        '</div>' +
        '<div class="lg-core">' +
          '<p class="lg-wm">VEGETARIAN<b>HULK</b></p>' +
          '<svg class="lg-mk" viewBox="0 0 72 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 50 26 14l11 17 8-12 23 31"/></svg>' +
          '<p class="lg-eye">Bald live</p>' +
          '<h1 class="lg-h1">Der Berg <em>wächst.</em></h1>' +
          '<p class="lg-story">Zehn Jahre am Berg — jetzt die nächste Höhe.</p>' +
          '<div class="lg-cd" role="timer" aria-live="off">' +
            '<div class="u"><div class="n" id="lg-d">–</div><div class="l">Tage</div></div>' +
            '<div class="u"><div class="n" id="lg-h">–</div><div class="l">Std</div></div>' +
            '<div class="u"><div class="n" id="lg-m">–</div><div class="l">Min</div></div>' +
            '<div class="u"><div class="n" id="lg-s">–</div><div class="l">Sek</div></div>' +
          '</div>' +
          '<p class="lg-when">' + LAUNCH_LABEL + '</p>' +
          '<p class="lg-sub">Die neue VegetarianHulk-Seite geht bald live. Trag dich ein — dann bist du als Erste:r dabei, wenn der Berg aufgeht.</p>' +
          '<form class="lg-form" id="lg-form" novalidate>' +
            '<input id="lg-email" type="email" inputmode="email" autocomplete="email" placeholder="deine@email.de" aria-label="Deine E-Mail-Adresse" required>' +
            '<button type="submit">Sei dabei</button>' +
          '</form>' +
          '<p class="lg-note" id="lg-note">Kein Spam. Abmeldung jederzeit. &nbsp;·&nbsp; <a href="https://www.instagram.com/vegetarianhulk/" target="_blank" rel="noopener">@vegetarianhulk</a></p>' +
          '<p class="lg-foot"><a href="/impressum.html">Impressum</a> &nbsp;·&nbsp; <a href="/datenschutz.html">Datenschutz</a></p>' +
        '</div>' +
        '<div id="lg-flare"></div>';
      document.body.appendChild(ov);

      var hd = document.getElementById('lg-hide');
      if (hd) hd.textContent = 'body>*{visibility:hidden!important}#lg-overlay,#lg-overlay *{visibility:visible!important}';

      // ---- Partikel (aufsteigende Licht-Motes) ----
      try {
        var cv = document.getElementById('lg-fx'), cx = cv.getContext('2d'), W, H, ps = [];
        function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
        size(); addEventListener('resize', size);
        var N = Math.min(46, Math.round(innerWidth / 34));
        for (var i = 0; i < N; i++) ps.push({ x: Math.random() * 9999 % 1 * 0 + Math.random() * innerWidth, y: Math.random() * innerHeight, r: 0.6 + Math.random() * 1.7, s: 0.15 + Math.random() * 0.5, a: 0.15 + Math.random() * 0.45, d: Math.random() * 6.28 });
        function draw() {
          cx.clearRect(0, 0, W, H);
          for (var j = 0; j < ps.length; j++) { var p = ps[j];
            p.y -= p.s; p.d += 0.01; p.x += Math.sin(p.d) * 0.25;
            if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
            cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283);
            cx.fillStyle = 'rgba(' + (Math.random() < 0.25 ? '230,200,120' : '150,200,165') + ',' + p.a + ')';
            cx.fill();
          }
          raf = requestAnimationFrame(draw);
        }
        if (!matchMedia('(prefers-reduced-motion:reduce)').matches) draw();
      } catch (e) {}

      // ---- Countdown ----
      var dE = document.getElementById('lg-d'), hE = document.getElementById('lg-h'), mE = document.getElementById('lg-m'), sE = document.getElementById('lg-s');
      function tick() {
        var diff = LAUNCH_TS - Date.now();
        if (diff <= 0) { clearInterval(timer); reveal(); return; }
        var s = Math.floor(diff / 1000);
        dE.textContent = Math.floor(s / 86400); hE.textContent = pad(Math.floor(s / 3600) % 24);
        mE.textContent = pad(Math.floor(s / 60) % 60); sE.textContent = pad(s % 60);
      }
      tick(); var timer = setInterval(tick, 1000);

      // ---- Reveal ----
      function reveal() {
        document.documentElement.classList.add('lg-reveal');
        var h = document.getElementById('lg-hide'); if (h && h.parentNode) h.parentNode.removeChild(h);
        setTimeout(function () { if (raf) cancelAnimationFrame(raf); var o = document.getElementById('lg-overlay'); if (o && o.parentNode) o.parentNode.removeChild(o); }, 1350);
      }

      // ---- Signup ----
      var form = document.getElementById('lg-form'), note = document.getElementById('lg-note');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (document.getElementById('lg-email').value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = 'E-Mail-Adresse prüfen.'; return; }
        note.textContent = 'Wird eingetragen …';
        fetch(NL_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, brand: 'vegetarianhulk', firstName: '', consent: true, consentText: 'Launch-Benachrichtigung + Newsletter, Abmeldung jederzeit' }) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function () { form.style.display = 'none'; note.innerHTML = '<strong style="color:#7ED09B">Du bist dabei.</strong> Wir sehen uns oben. 🏔️'; })
          .catch(function () { note.textContent = 'Hat nicht geklappt — später nochmal.'; });
      });
    }

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
  } catch (e) { /* fail-open */ }
})();
