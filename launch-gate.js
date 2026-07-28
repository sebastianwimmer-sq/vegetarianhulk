/* ============================================================
   VegetarianHulk — Launch-Gate (Coming-Soon-Blocker + Countdown + Reveal)
   Selbst-enthalten. SYNCHRON im <head> einbinden (KEIN defer/async), damit
   kein Flash der echten Seite entsteht:
       <script src="/launch-gate.js"></script>
   Verhalten:
     - Vor LAUNCH_TS: Vollbild-Countdown-Overlay, Seite verborgen.
     - Impressum/Datenschutz (ALLOWLIST): NIE gesperrt (Rechtspflicht).
     - Vorschau-Bypass: ?vorschau=<PREVIEW_SECRET> → merkt sich in localStorage
       → Gate übersprungen (für Sebi/QA, um die echte Live-Seite zu prüfen).
     - Ab LAUNCH_TS: kein Overlay; läuft der Countdown live ab, spielt der Reveal.
     - Fail-open: jeder Fehler → Seite zeigt normal (nie weißer Bildschirm).
   ============================================================ */
(function () {
  'use strict';
  try {
    /* ===================== CONFIG (nur hier ändern) ===================== */
    var LAUNCH_TS = Date.parse('2026-08-11T18:00:00+02:00'); // ⏰ PLATZHALTER — Wunsch-Datum eintragen
    var PREVIEW_SECRET = 'bergauf2026';                       // 🔑 Vorschau-Link: ?vorschau=bergauf2026
    var ALLOWLIST = ['/impressum.html', '/datenschutz.html']; // immer erreichbar
    var LAUNCH_LABEL = '11. August 2026, 18:00';              // Anzeige im Overlay
    var NL_ENDPOINT = 'https://peaking-ai-api.peaking.workers.dev/newsletter/subscribe';
    /* =================================================================== */

    if (!LAUNCH_TS) return; // ungültiges Datum → kein Gate (fail-open)

    var path = location.pathname;
    var normPath = path.replace(/index\.html$/, '').replace(/\/$/, '') || '/';

    // Vorschau-Parameter merken
    var qs;
    try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
    if (qs && qs.get('vorschau')) {
      try { localStorage.setItem('vhLaunchPreview', qs.get('vorschau')); } catch (e) {}
    }
    var isPreview = false;
    try { isPreview = localStorage.getItem('vhLaunchPreview') === PREVIEW_SECRET; } catch (e) {}

    var allowed = ALLOWLIST.indexOf(path) !== -1 || ALLOWLIST.indexOf(normPath) !== -1;
    if (Date.now() >= LAUNCH_TS || isPreview || allowed) return; // kein Gate nötig

    // ---- Sofort verbergen (vor dem Paint → kein Flash) ----
    var hide = document.createElement('style');
    hide.id = 'lg-hide';
    hide.textContent = 'html{background:#06140D}body>*{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hide);

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function build() {
      if (document.getElementById('lg-overlay')) return;

      var st = document.createElement('style');
      st.textContent = [
        '#lg-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;',
        'align-items:center;justify-content:center;text-align:center;padding:32px 22px;overflow:auto;',
        'background-color:#0B2418;background-image:radial-gradient(90% 55% at 50% 8%,rgba(126,208,155,.14),rgba(126,208,155,0) 60%),',
        'linear-gradient(168deg,#164A2B 0%,#0F3520 20%,#0B2418 46%,#0A2016 72%,#06140D 100%);',
        'color:#EDE4CF;font-family:\'Inter\',-apple-system,Helvetica,Arial,sans-serif;',
        'animation:lgIn .6s cubic-bezier(.16,1,.3,1) both}',
        '@keyframes lgIn{from{opacity:0}to{opacity:1}}',
        '#lg-overlay .wm{font-size:14px;font-weight:700;letter-spacing:.36em;color:#F3EBD9}',
        '#lg-overlay .wm b{color:#7ED09B;font-weight:700}',
        '#lg-overlay .mtn{width:52px;height:38px;margin:26px 0 18px;color:#7ED09B}',
        '#lg-overlay .mtn path{stroke-dasharray:180;stroke-dashoffset:180;animation:lgDraw 1.3s cubic-bezier(.16,1,.3,1) .2s forwards}',
        '@keyframes lgDraw{to{stroke-dashoffset:0}}',
        '#lg-overlay .eye{font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#D8B24A}',
        '#lg-overlay h1{margin:14px 0 0;font-family:\'Playfair Display\',Georgia,serif;font-weight:700;',
        'font-size:clamp(30px,6vw,50px);line-height:1.06;letter-spacing:-.5px;color:#F5EEDD;max-width:16ch}',
        '#lg-overlay h1 em{font-style:italic;color:#7ED09B}',
        '#lg-overlay .cd{display:flex;gap:clamp(10px,3vw,26px);margin:30px 0 6px}',
        '#lg-overlay .cd .u{min-width:58px}',
        '#lg-overlay .cd .n{font-family:\'Playfair Display\',Georgia,serif;font-weight:700;font-size:clamp(34px,8vw,60px);line-height:1;color:#F5EEDD}',
        '#lg-overlay .cd .l{margin-top:8px;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#8FB79C}',
        '#lg-overlay .when{margin-top:10px;font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:15px;color:#9FB6A4}',
        '#lg-overlay .sub{margin:26px 0 0;font-size:15px;line-height:1.6;color:#DDE5DB;max-width:34ch}',
        '#lg-overlay form{margin:16px auto 0;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:400px;width:100%}',
        '#lg-overlay input{flex:1;min-width:190px;padding:14px 16px;border-radius:11px;border:1px solid rgba(126,208,155,.3);',
        'background:rgba(6,20,13,.5);color:#F3EBD9;font-size:15px;font-family:inherit}',
        '#lg-overlay input::placeholder{color:#7E9184}',
        '#lg-overlay input:focus{outline:2px solid #7ED09B;outline-offset:1px}',
        '#lg-overlay button{padding:14px 24px;border:0;border-radius:11px;cursor:pointer;',
        'font-family:inherit;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#14100A;',
        'background-image:linear-gradient(180deg,#F6D24A,#E4B824 55%,#C6980F)}',
        '#lg-overlay .note{margin-top:12px;font-size:12px;color:#9FB6A4}',
        '#lg-overlay .ig{color:#7ED09B;text-decoration:none;font-weight:700}',
        '#lg-overlay .foot{margin-top:30px;font-size:11.5px;color:#5E7267}',
        '#lg-overlay .foot a{color:#8FB79C;text-decoration:none}',
        'html.lg-reveal #lg-overlay{animation:lgOut 1.1s cubic-bezier(.16,1,.3,1) forwards}',
        '@keyframes lgOut{to{opacity:0;transform:translateY(-40px) scale(1.04);visibility:hidden}}'
      ].join('');
      document.head.appendChild(st);

      var ov = document.createElement('div');
      ov.id = 'lg-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', 'VegetarianHulk — bald verfügbar');
      ov.innerHTML =
        '<p class="wm">VEGETARIAN<b>HULK</b></p>' +
        '<svg class="mtn" viewBox="0 0 72 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 50 26 14l11 17 8-12 23 31"/></svg>' +
        '<p class="eye">Bald live</p>' +
        '<h1>Der Berg <em>wächst.</em></h1>' +
        '<div class="cd" id="lg-cd" role="timer" aria-live="off">' +
          '<div class="u"><div class="n" id="lg-d">–</div><div class="l">Tage</div></div>' +
          '<div class="u"><div class="n" id="lg-h">–</div><div class="l">Std</div></div>' +
          '<div class="u"><div class="n" id="lg-m">–</div><div class="l">Min</div></div>' +
          '<div class="u"><div class="n" id="lg-s">–</div><div class="l">Sek</div></div>' +
        '</div>' +
        '<p class="when">' + LAUNCH_LABEL + '</p>' +
        '<p class="sub">Die neue VegetarianHulk-Seite geht bald live. Trag dich ein — dann bist du als Erste:r dabei, wenn der Berg aufgeht.</p>' +
        '<form id="lg-form" novalidate>' +
          '<input id="lg-email" type="email" inputmode="email" autocomplete="email" placeholder="deine@email.de" aria-label="Deine E-Mail-Adresse" required>' +
          '<button type="submit">Sei dabei</button>' +
        '</form>' +
        '<p class="note" id="lg-note">Kein Spam. Abmeldung jederzeit. &nbsp;·&nbsp; <a class="ig" href="https://www.instagram.com/vegetarianhulk/" target="_blank" rel="noopener">@vegetarianhulk</a></p>' +
        '<p class="foot"><a href="/impressum.html">Impressum</a> &nbsp;·&nbsp; <a href="/datenschutz.html">Datenschutz</a></p>';
      document.body.appendChild(ov);

      // Overlay ist sichtbar; die (verborgene) Seite bleibt dahinter.
      var hd = document.getElementById('lg-hide');
      if (hd) hd.textContent = 'body>*{visibility:hidden!important}#lg-overlay{visibility:visible!important}#lg-overlay *{visibility:visible!important}';

      // ---- Countdown ----
      var dE = document.getElementById('lg-d'), hE = document.getElementById('lg-h'),
          mE = document.getElementById('lg-m'), sE = document.getElementById('lg-s');
      function tick() {
        var diff = LAUNCH_TS - Date.now();
        if (diff <= 0) { clearInterval(timer); reveal(); return; }
        var s = Math.floor(diff / 1000);
        dE.textContent = Math.floor(s / 86400);
        hE.textContent = pad(Math.floor(s / 3600) % 24);
        mE.textContent = pad(Math.floor(s / 60) % 60);
        sE.textContent = pad(s % 60);
      }
      tick();
      var timer = setInterval(tick, 1000);

      // ---- Reveal (Vorhang hebt sich → echte Seite) ----
      function reveal() {
        document.documentElement.classList.add('lg-reveal');
        var h = document.getElementById('lg-hide');
        if (h) h.parentNode.removeChild(h); // Seite wird sichtbar
        setTimeout(function () {
          var o = document.getElementById('lg-overlay');
          if (o && o.parentNode) o.parentNode.removeChild(o);
        }, 1100);
      }

      // ---- Signup (nutzt den echten Newsletter-Endpoint) ----
      var form = document.getElementById('lg-form'), note = document.getElementById('lg-note');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (document.getElementById('lg-email').value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = 'E-Mail-Adresse prüfen.'; return; }
        note.textContent = 'Wird eingetragen …';
        fetch(NL_ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, brand: 'vegetarianhulk', firstName: '', consent: true, consentText: 'Launch-Benachrichtigung + Newsletter + Berg-Starter, Abmeldung jederzeit' })
        }).then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function () { form.style.display = 'none'; note.innerHTML = '<strong style="color:#7ED09B">Du bist dabei.</strong> Wir sehen uns oben. 🏔️'; })
          .catch(function () { note.textContent = 'Hat nicht geklappt — später nochmal probieren.'; });
      });
    }

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
  } catch (e) { /* fail-open: Seite zeigt normal */ }
})();
