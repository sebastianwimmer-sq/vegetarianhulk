/* ============================================================
   VegetarianHulk — Launch-Gate (echtes Foto-Hero + Countdown + Reveal)
   Selbst-enthalten. SYNCHRON im <head> einbinden (KEIN defer/async):
       <script src="/launch-gate.js?v=3"></script>
   Anti-Slop: full-bleed echtes Bergfoto + Forest-Scrim + editoriale Typo
   (keine Vektor-Berge, keine schwebenden Partikel).
   - Vor LAUNCH_TS: Vollbild-Foto-Szene + Countdown. Seite verborgen, kein Flash.
   - Impressum/Datenschutz (ALLOWLIST): nie gesperrt.
   - Vorschau: ?vorschau=<PREVIEW_SECRET> → Bypass · ?vorschau=aus → Gate wieder an.
   - Bei 0: Reveal → echte Seite. Fail-open bei Fehlern.
   ============================================================ */
(function () {
  'use strict';
  try {
    /* ===================== CONFIG (nur hier ändern) ===================== */
    var LAUNCH_TS = Date.parse('2026-08-15T18:00:00+02:00'); // 🎂 Launch-Event zu Sebis Geburtstag
    var PREVIEW_SECRET = 'bergauf2026';                       // 🔑 ?vorschau=bergauf2026
    var ALLOWLIST = ['/impressum.html', '/datenschutz.html'];
    var LAUNCH_LABEL = '15. August 2026, 18:00';
    var NL_ENDPOINT = 'https://vh-forms.peaking.workers.dev/newsletter/subscribe';
    var BG_IMAGE = 'https://vegetarianhulk.de/email-templates/assets/hero-berg-mail.jpg'; // echtes Bergfoto (live)
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

    var hide = document.createElement('style');
    hide.id = 'lg-hide';
    hide.textContent = 'html{background:#06120C}body>*{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hide);

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

    function build() {
      if (document.getElementById('lg-overlay')) return;
      var st = document.createElement('style');
      st.textContent = [
        '#lg-overlay{position:fixed;inset:0;z-index:2147483647;overflow:hidden;background:#06120C;',
        'font-family:\'Inter\',-apple-system,Helvetica,Arial,sans-serif;color:#F3EBD9}',
        // echtes Foto full-bleed + langsamer Zoom
        '#lg-bg{position:absolute;inset:0;background:#06120C}',
        '#lg-bg img{width:100%;height:100%;object-fit:cover;opacity:.58;animation:lgZoom 24s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgZoom{from{transform:scale(1.12)}to{transform:scale(1)}}',
        // Forest-Scrim für Stimmung + Lesbarkeit
        '#lg-bg::after{content:"";position:absolute;inset:0;',
        'background:linear-gradient(180deg,rgba(6,20,12,.82) 0%,rgba(7,26,16,.5) 32%,rgba(5,18,11,.72) 74%,rgba(4,14,9,.95) 100%),',
        'radial-gradient(80% 60% at 50% 40%,rgba(126,208,155,.10),transparent 66%)}',
        '#lg-grain{position:absolute;inset:0;background-image:url("' + GRAIN + '");opacity:.22;mix-blend-mode:overlay;pointer-events:none}',
        // Content editorial
        '.lg-core{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'text-align:center;padding:34px 22px;overflow:auto}',
        '.lg-core>*{opacity:0;transform:translateY(16px);animation:lgUp .9s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgUp{to{opacity:1;transform:none}}',
        '.lg-wm{font-size:14px;font-weight:700;letter-spacing:.36em;color:#F3EBD9;text-shadow:0 2px 18px rgba(3,12,8,.8);animation-delay:.05s}',
        '.lg-wm b{color:#7ED09B}',
        '.lg-mk{width:52px;height:38px;margin:22px 0 16px;color:#7ED09B;filter:drop-shadow(0 6px 22px rgba(4,89,39,.6));animation-delay:.15s}',
        '.lg-mk path{stroke-dasharray:190;stroke-dashoffset:190;animation:lgDraw 1.5s cubic-bezier(.16,1,.3,1) .4s forwards}',
        '@keyframes lgDraw{to{stroke-dashoffset:0}}',
        '.lg-eye{font-size:11px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#E7C25A;text-shadow:0 2px 14px rgba(3,12,8,.7);animation-delay:.25s}',
        '.lg-h1{margin:14px 0 0;font-family:\'Playfair Display\',Georgia,serif;font-weight:700;font-size:clamp(36px,7.4vw,70px);',
        'line-height:1.02;letter-spacing:-.6px;color:#F7F0E1;text-shadow:0 3px 34px rgba(3,12,8,.85);animation-delay:.3s}',
        '.lg-h1 em{font-style:italic;color:#8FE0AC}',
        '.lg-story{margin:16px 0 0;font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:clamp(15px,2.2vw,18px);color:#C7D6C4;text-shadow:0 2px 16px rgba(3,12,8,.8);animation-delay:.4s}',
        '.lg-cd{display:flex;gap:clamp(12px,3.4vw,30px);margin:32px 0 4px;animation-delay:.5s}',
        '.lg-cd .u{min-width:56px}',
        '.lg-cd .n{font-family:\'Playfair Display\',Georgia,serif;font-weight:700;font-size:clamp(38px,8.6vw,66px);line-height:1;color:#F7F0E1;text-shadow:0 3px 24px rgba(3,12,8,.85)}',
        '.lg-cd .l{margin-top:9px;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#A7C0AD}',
        '.lg-when{margin-top:12px;font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:14px;color:#9FB6A4;text-shadow:0 2px 12px rgba(3,12,8,.7);animation-delay:.55s}',
        '.lg-sub{margin:24px 0 0;font-size:15px;line-height:1.6;color:#E4ECE2;text-shadow:0 2px 14px rgba(3,12,8,.7);max-width:34ch;animation-delay:.62s}',
        '.lg-form{margin:16px auto 0;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:400px;width:100%;animation-delay:.7s}',
        '.lg-form input{flex:1;min-width:190px;padding:14px 16px;border-radius:11px;border:1px solid rgba(126,208,155,.34);',
        'background:rgba(5,16,10,.62);color:#F3EBD9;font-size:15px;font-family:inherit;backdrop-filter:blur(3px)}',
        '.lg-form input::placeholder{color:#8AA093}.lg-form input:focus{outline:2px solid #7ED09B;outline-offset:1px}',
        '.lg-form button{padding:14px 26px;border:0;border-radius:11px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;',
        'letter-spacing:.06em;text-transform:uppercase;color:#14100A;background-image:linear-gradient(180deg,#F6D24A,#E4B824 55%,#C6980F);',
        'box-shadow:0 14px 30px -8px rgba(0,0,0,.6);transition:transform .2s}',
        '.lg-form button:hover{transform:translateY(-2px)}',
        '.lg-note{margin-top:12px;font-size:12px;color:#B7C7B8;text-shadow:0 1px 10px rgba(3,12,8,.7);animation-delay:.76s}.lg-note a{color:#8FE0AC;text-decoration:none;font-weight:700}',
        '.lg-foot{margin-top:26px;font-size:11.5px;color:#8AA093;animation-delay:.82s}.lg-foot a{color:#B7C7B8;text-decoration:none}',
        'html.lg-reveal #lg-overlay{animation:lgOut 1.2s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgOut{40%{opacity:1}to{opacity:0;transform:scale(1.06);visibility:hidden}}',
        '@media (prefers-reduced-motion:reduce){#lg-bg img{animation:none;transform:none}.lg-core>*{animation:none;opacity:1;transform:none}.lg-mk path{stroke-dashoffset:0}}'
      ].join('');
      document.head.appendChild(st);

      var ov = document.createElement('div');
      ov.id = 'lg-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', 'VegetarianHulk — bald live');
      ov.innerHTML =
        '<div id="lg-bg"><img src="' + BG_IMAGE + '" alt=""></div>' +
        '<div id="lg-grain"></div>' +
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
        '</div>';
      document.body.appendChild(ov);

      var hd = document.getElementById('lg-hide');
      if (hd) hd.textContent = 'body>*{visibility:hidden!important}#lg-overlay,#lg-overlay *{visibility:visible!important}';

      var dE = document.getElementById('lg-d'), hE = document.getElementById('lg-h'), mE = document.getElementById('lg-m'), sE = document.getElementById('lg-s');
      function tick() {
        var diff = LAUNCH_TS - Date.now();
        if (diff <= 0) { clearInterval(timer); reveal(); return; }
        var s = Math.floor(diff / 1000);
        dE.textContent = Math.floor(s / 86400); hE.textContent = pad(Math.floor(s / 3600) % 24);
        mE.textContent = pad(Math.floor(s / 60) % 60); sE.textContent = pad(s % 60);
      }
      tick(); var timer = setInterval(tick, 1000);

      function reveal() {
        document.documentElement.classList.add('lg-reveal');
        var h = document.getElementById('lg-hide'); if (h && h.parentNode) h.parentNode.removeChild(h);
        setTimeout(function () { var o = document.getElementById('lg-overlay'); if (o && o.parentNode) o.parentNode.removeChild(o); }, 1250);
      }

      var form = document.getElementById('lg-form'), note = document.getElementById('lg-note');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (document.getElementById('lg-email').value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = 'E-Mail-Adresse prüfen.'; return; }
        note.textContent = 'Wird eingetragen …';
        fetch(NL_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, brand: 'vegetarianhulk', firstName: '', consent: true, consentText: 'Launch-Benachrichtigung + Newsletter, Abmeldung jederzeit' }) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function () { form.style.display = 'none'; note.innerHTML = '<strong style="color:#8FE0AC">Du bist dabei.</strong> Wir sehen uns oben. 🏔️'; })
          .catch(function () { note.textContent = 'Hat nicht geklappt — später nochmal.'; });
      });
    }

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
  } catch (e) { /* fail-open */ }
})();
