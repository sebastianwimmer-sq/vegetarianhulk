/* ============================================================
   touren/tour.js — Verhalten aller Hulk-Hike-Detailseiten.
   Lag vorher als kopierter <script>-Block in jeder Tour-Datei; jede
   neue Tour schleppte ihn mit, jede Korrektur musste n-mal passieren.

   Alles ist ueber data-Attribute parametrisiert. Eine Tour-Datei
   traegt nur noch DATEN, kein Verhalten.
   ============================================================ */
(function () {
  'use strict';

  var sanftBevorzugt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hoehenprofil: zeichnet sich beim Sichtbarwerden ---------- */
  var profil = document.querySelector('.tour-profil');
  if (profil) {
    if (!('IntersectionObserver' in window)) {
      profil.classList.add('in');
    } else {
      var beobachter = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          if (e.isIntersecting) { profil.classList.add('in'); beobachter.disconnect(); }
        });
      }, { rootMargin: '0px 0px -15% 0px' });
      beobachter.observe(profil);
    }
  }

  /* ---------- Hoehenprofil ablesen ----------
     Das SVG traegt die echten Messpunkte als data-punkte="km,hoehe km,hoehe …".
     Bewusst NICHT aus den SVG-Koordinaten zurueckgerechnet: die sind fuers Auge
     geglaettet, die Zahl am Zeiger soll aber stimmen. Zwischen zwei Punkten
     wird linear interpoliert. */
  (function ablesenAktivieren() {
    if (!profil) return;
    var svg = profil.querySelector('.tour-svg');
    var zeiger = profil.querySelector('.tour-profil__zeiger');
    var wert = profil.querySelector('.tour-profil__wert');
    if (!svg || !zeiger || !wert || !svg.dataset.punkte) return;

    var punkte = svg.dataset.punkte.trim().split(/\s+/).map(function (paar) {
      var t = paar.split(',');
      return { km: parseFloat(t[0]), hoehe: parseFloat(t[1]) };
    }).filter(function (p) { return isFinite(p.km) && isFinite(p.hoehe); });
    if (punkte.length < 2) return;

    var gesamtKm = punkte[punkte.length - 1].km;
    if (!(gesamtKm > 0)) return;

    // Erfassungsflaeche: SVG-Bereiche ohne fill sind fuer Pointer-Events durchlaessig,
    // ueber der leeren Flaeche oberhalb der Linie kaeme also nie ein Event an.
    // Das Rechteck wird hier eingezogen, damit keine Tour-Datei es vergessen kann.
    var kasten = svg.viewBox.baseVal;
    var flaeche = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    flaeche.setAttribute('x', kasten.x || 0);
    flaeche.setAttribute('y', kasten.y || 0);
    flaeche.setAttribute('width', kasten.width || 900);
    flaeche.setAttribute('height', kasten.height || 270);
    flaeche.setAttribute('fill', 'transparent');
    svg.appendChild(flaeche);

    function hoeheBei(km) {
      for (var i = 1; i < punkte.length; i++) {
        if (km <= punkte[i].km) {
          var a = punkte[i - 1], b = punkte[i];
          var spanne = b.km - a.km;
          var t = spanne > 0 ? (km - a.km) / spanne : 0;
          return a.hoehe + (b.hoehe - a.hoehe) * t;
        }
      }
      return punkte[punkte.length - 1].hoehe;
    }

    var zahl = function (n) { return Math.round(n).toLocaleString('de-DE'); };

    function ablesen(clientX) {
      var kasten = svg.getBoundingClientRect();
      if (!kasten.width) return;
      var anteil = Math.min(1, Math.max(0, (clientX - kasten.left) / kasten.width));
      var km = anteil * gesamtKm;
      var hoehe = hoeheBei(km);

      var x = anteil * kasten.width;
      zeiger.style.left = x + 'px';
      // Blase bleibt im Kasten, damit sie an den Raendern nicht abgeschnitten wird
      var rand = 76;
      wert.style.left = Math.min(kasten.width - rand, Math.max(rand, x)) + 'px';
      wert.style.top = '18px';
      wert.innerHTML = '<b>' + zahl(hoehe) + ' m</b> · ' +
        km.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
      profil.classList.add('liest');
    }

    var zeigerAus = function () { profil.classList.remove('liest'); };

    svg.addEventListener('pointermove', function (e) { ablesen(e.clientX); });
    svg.addEventListener('pointerdown', function (e) { ablesen(e.clientX); });
    svg.addEventListener('pointerleave', zeigerAus);
    svg.addEventListener('pointercancel', zeigerAus);
    window.addEventListener('blur', zeigerAus);
  })();

  /* ---------- Hero-Zahlen: Count-up ---------- */
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var ziel = parseInt(el.dataset.count, 10);
    if (!isFinite(ziel)) return;
    var fmt = function (n) { return n.toLocaleString('de-DE'); };
    if (sanftBevorzugt) { el.textContent = fmt(ziel); return; }
    var start = null, DAUER = 1500;
    function schritt(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / DAUER);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(ziel * e));
      if (p < 1) requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  });

  /* ---------- Live am Gipfel (Open-Meteo) ----------
     Parameter am Fakten-Strip: data-lat, data-lon, data-hoehe.
     data-hoehe MUSS die Gipfelhoehe dieser Tour sein — tour-check.mjs prueft das.
     Faellt der Call aus, bleiben die Live-Fakten lautlos versteckt. */
  (function live() {
    var strip = document.querySelector('[data-live]');
    if (!strip || !window.fetch) return;
    var lat = strip.dataset.lat, lon = strip.dataset.lon, hoehe = strip.dataset.hoehe;
    if (!lat || !lon || !hoehe) return;

    var wetterBox = strip.querySelector('[data-wetter]');
    var dawnBox = strip.querySelector('[data-sonnenaufgang]');

    var WMO = function (cd) {
      return cd === 0 ? 'klar' : cd <= 2 ? 'leicht bewölkt' : cd === 3 ? 'bedeckt'
        : cd <= 48 ? 'Nebel' : cd <= 67 ? 'Regen' : cd <= 77 ? 'Schneefall'
        : cd <= 82 ? 'Schauer' : 'Gewitter';
    };
    var IC = {
      sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/>',
      suncloud: '<circle cx="8.4" cy="8.2" r="3.4"/><path d="M8.4 2.6v1.8M2.8 8.2h1.8M4.4 4.2l1.3 1.3"/><path d="M8.6 18.4h8.9a3.1 3.1 0 0 0 .4-6.2 4.6 4.6 0 0 0-9-.9 3.6 3.6 0 0 0-.3 7.1z"/>',
      cloud: '<path d="M7.4 18.2h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/>',
      fog: '<path d="M4 9.6h16M4 13h13M6 16.4h12M8 19.8h9"/>',
      rain: '<path d="M7.4 14.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M8.6 17.4l-1 2.6M12.6 17.4l-1 2.6M16.6 17.4l-1 2.6"/>',
      snow: '<path d="M7.4 14.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M8.4 18.4h.01M12.2 20h.01M16 18.4h.01" stroke-linecap="round" stroke-width="2.1"/>',
      storm: '<path d="M7.4 13.6h9.9a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.8-1 3.9 3.9 0 0 0-.6 7.8z"/><path d="M12.8 15l-2.4 3.4h3l-2.2 3.4"/>'
    };
    var schluessel = function (cd) {
      return cd === 0 ? 'sun' : cd <= 2 ? 'suncloud' : cd === 3 ? 'cloud'
        : cd <= 48 ? 'fog' : cd <= 67 ? 'rain' : cd <= 77 ? 'snow'
        : cd <= 82 ? 'rain' : 'storm';
    };

    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + encodeURIComponent(lat)
      + '&longitude=' + encodeURIComponent(lon)
      + '&elevation=' + encodeURIComponent(hoehe)
      + '&current=temperature_2m,weather_code'
      + (dawnBox ? '&daily=sunrise&forecast_days=2' : '')
      + '&timezone=Europe%2FBerlin';

    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        if (dawnBox && d.daily && d.daily.sunrise) {
          // [0] ist heute und mittags laengst vorbei — der naechste ist der von morgen
          var jetzt = new Date();
          var heute = new Date(d.daily.sunrise[0]);
          var quelle = (jetzt < heute) ? d.daily.sunrise[0] : (d.daily.sunrise[1] || d.daily.sunrise[0]);
          var zeit = (quelle || '').slice(11, 16);
          if (zeit) {
            dawnBox.querySelector('[data-sonnenaufgang-zeit]').textContent = zeit;
            var label = dawnBox.querySelector('[data-sonnenaufgang-label]');
            if (label) label.textContent = (jetzt < heute) ? 'Sonnenaufgang heute' : 'Sonnenaufgang morgen';
            dawnBox.hidden = false;
          }
        }
        if (wetterBox && d.current) {
          wetterBox.querySelector('[data-temp]').textContent = Math.round(d.current.temperature_2m);
          wetterBox.querySelector('[data-cond]').textContent = WMO(d.current.weather_code);
          wetterBox.querySelector('[data-ico]').innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" '
            + 'stroke-linejoin="round" aria-hidden="true">' + IC[schluessel(d.current.weather_code)] + '</svg>';
          wetterBox.hidden = false;
        }
      })
      .catch(function () { /* lautlos: eine Tour ohne Live-Wert ist kein Fehler */ });
  })();
})();
