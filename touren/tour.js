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

  /* Diagramm-Geometrie. MUSS vor dem ersten Aufruf stehen — `var`-Zuweisungen
     werden nicht gehoistet, und ein undefined hier macht jede Koordinate zu NaN,
     ohne einen Fehler zu werfen. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BREITE = 900, HOEHE = 270, OBEN = 18, UNTEN = 254;

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

  /* ---------- Hoehenprofil ----------
     `data-punkte="km,hoehe km,hoehe …"` am SVG ist die EINZIGE Quelle. Daraus
     zeichnet dieses Skript Kurve, Flaeche, beschriftete Hoehenachse, Kilometer-
     achse und die Gipfelmarke — und macht das Diagramm ablesbar.

     Warum hier und nicht im HTML: vorher stand der Pfad handgeschrieben in jeder
     Tour-Datei. Jede Verbesserung am Diagramm haette dann pro Tour nachgezogen
     werden muessen, und genau so entstand der Zustand, dass eine Tour Achsen und
     Ablesen hatte und die andere eine nackte Linie im leeren Kasten.

     Der statische Pfad im HTML bleibt als Fallback fuer den Fall ohne JS. */
  (function diagramm() {
    if (!profil) return;
    var svg = profil.querySelector('.tour-svg');
    var zeiger = profil.querySelector('.tour-profil__zeiger');
    var wert = profil.querySelector('.tour-profil__wert');
    if (!svg || !svg.dataset.punkte) return;

    var punkte = svg.dataset.punkte.trim().split(/\s+/).map(function (paar) {
      var t = paar.split(',');
      return { km: parseFloat(t[0]), hoehe: parseFloat(t[1]) };
    }).filter(function (p) { return isFinite(p.km) && isFinite(p.hoehe); });
    if (punkte.length < 2) return;

    zeichneDiagramm(svg, punkte);
    if (!zeiger || !wert) return;

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


  /* Zeichnet Kurve, Flaeche und beide Achsen aus den Messpunkten.
     viewBox 0 0 900 270 · preserveAspectRatio="none" — deshalb steht KEIN Text im
     SVG: er wuerde mitverzerrt. Die Achsenbeschriftung kommt als HTML obendrauf. */
  function zeichneDiagramm(svg, punkte) {
    var kmMax = punkte[punkte.length - 1].km;
    var hoehen = punkte.map(function (p) { return p.hoehe; });
    var hMin = Math.min.apply(null, hoehen), hMax = Math.max.apply(null, hoehen);
    if (!(kmMax > 0) || !(hMax > hMin)) return;

    var x = function (km) { return km / kmMax * BREITE; };
    var y = function (h) { return UNTEN - (h - hMin) / (hMax - hMin) * (UNTEN - OBEN); };

    // Kurve und Flaeche aus den echten Punkten neu setzen
    var d = punkte.map(function (p, i) {
      return (i ? 'L' : 'M') + x(p.km).toFixed(1) + ',' + y(p.hoehe).toFixed(1);
    }).join(' ');
    var linie = svg.querySelector('.line'), flaeche = svg.querySelector('.fill');
    if (linie) linie.setAttribute('d', d);
    if (flaeche) flaeche.setAttribute('d', d + ' L' + BREITE + ',' + HOEHE + ' L0,' + HOEHE + ' Z');

    // Hoehenachse: die feinste runde Stufe nehmen, die hoechstens 4 Marken ergibt.
    // Eine feste Teilung durch 3 lieferte je nach Spanne mal 2, mal 5 Marken.
    var marken = achsenMarken(hMin, hMax, 4);

    [].forEach.call(svg.querySelectorAll('.tour-profil__gridline'), function (l) { l.remove(); });
    var achse = profil.querySelector('.tour-profil__achse');
    if (achse) achse.innerHTML = '';

    marken.forEach(function (h) {
      var linieY = y(h);
      var g = document.createElementNS(SVG_NS, 'line');
      g.setAttribute('class', 'tour-profil__gridline');
      g.setAttribute('x1', 0); g.setAttribute('x2', BREITE);
      g.setAttribute('y1', linieY); g.setAttribute('y2', linieY);
      svg.insertBefore(g, svg.firstChild);
      if (achse) {
        var t = document.createElement('span');
        t.className = 'tour-profil__tick tour-profil__tick--y';
        t.style.top = (linieY / HOEHE * 100) + '%';
        t.textContent = h.toLocaleString('de-DE') + ' m';
        achse.appendChild(t);
      }
    });

    // Kilometerachse
    if (achse) {
      var kmSchritt = grobeStufe(kmMax / 4);
      for (var km = kmSchritt; km < kmMax - kmSchritt * 0.4; km += kmSchritt) {
        var k = document.createElement('span');
        k.className = 'tour-profil__tick tour-profil__tick--x';
        k.style.left = (x(km) / BREITE * 100) + '%';
        k.textContent = km.toLocaleString('de-DE') + ' km';
        achse.appendChild(k);
      }
    }

    // Gipfelmarke sitzt auf dem Hochpunkt — nicht mehr pro Tour von Hand gesetzt
    var gipfel = punkte.reduce(function (a, b) { return b.hoehe > a.hoehe ? b : a; });
    var marke = profil.querySelector('.tour-profil__marke--gipfel');
    if (marke) {
      var anteil = x(gipfel.km) / BREITE;
      marke.style.left = 'calc(' + (anteil * 100).toFixed(1) + '% + 12px)';
      marke.style.top = Math.max(0, y(gipfel.hoehe) / HOEHE * 100 - 6) + '%';
      // am rechten Rand wuerde die Marke hinauslaufen: dann nach links kippen
      if (anteil > 0.62) {
        marke.style.left = 'auto';
        marke.style.right = 'calc(' + ((1 - anteil) * 100).toFixed(1) + '% + 12px)';
        marke.style.flexDirection = 'row-reverse';
      }
    }

    var punktGipfel = svg.querySelector('.sun-dot, .peak-marker');
    if (punktGipfel) { punktGipfel.setAttribute('cx', x(gipfel.km)); punktGipfel.setAttribute('cy', y(gipfel.hoehe)); }
    var kreuz = svg.querySelector('.peak-x');
    if (kreuz) kreuz.setAttribute('d', 'M' + x(gipfel.km) + ',' + y(gipfel.hoehe) + ' V' + (y(gipfel.hoehe) - 14) +
      ' M' + (x(gipfel.km) - 6) + ',' + (y(gipfel.hoehe) - 9) + ' h12');
    var startPunkt = svg.querySelector('.peak-dot');
    if (startPunkt) { startPunkt.setAttribute('cx', 0); startPunkt.setAttribute('cy', y(punkte[0].hoehe)); }
  }

  /* Runde Zwischenwerte zwischen min und max, hoechstens `maximal` Stueck.
     Probiert die Stufen von fein nach grob und nimmt die erste, die passt. */
  function achsenMarken(min, max, maximal) {
    var stufen = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (var i = 0; i < stufen.length; i++) {
      var werte = [];
      for (var h = Math.ceil(min / stufen[i]) * stufen[i]; h < max; h += stufen[i]) werte.push(h);
      if (werte.length <= maximal) return werte;
    }
    return [];
  }

  /* Runde Stufe (100/200/250/500 …) statt krummer Zwischenwerte auf der Achse */
  function grobeStufe(roh) {
    var groessen = [0.5, 1, 2, 2.5, 5, 10, 25, 50, 100, 200, 250, 500, 1000];
    var zehner = Math.pow(10, Math.floor(Math.log10(Math.max(roh, 0.001))));
    for (var i = 0; i < groessen.length; i++) {
      if (groessen[i] * zehner >= roh) return groessen[i] * zehner;
    }
    return roh;
  }


  /* ---------- Hub: Zahlen aus der Liste statt aus der Hand ----------
     Der Block "Der Guide in Zahlen" stand hartkodiert im HTML und war beim
     Hinzufuegen der Kneifelspitze still falsch geworden (7 Touren / 5.668 hm,
     waehrend die Liste schon 8 zeigte). Jetzt kommen die Werte aus denselben
     data-Attributen, die auch Filter und Sortierung benutzen — eine neue Tour
     zieht sie automatisch mit. Die Zahlen im HTML bleiben Fallback ohne JS. */
  (function guideZahlen() {
    var zeilen = document.querySelectorAll('.tk-row');
    if (!zeilen.length || !document.querySelector('[data-zahl]')) return;

    var hoehen = [];
    var summeHm = 0;
    [].forEach.call(zeilen, function (zeile) {
      var hm = parseInt(zeile.dataset.thm, 10);
      if (isFinite(hm)) summeHm += hm;
      // Gipfelhoehe steht sichtbar in der Zeile ("1.776 m")
      var alt = zeile.querySelector('.tk-row__alt');
      var treffer = alt && alt.textContent.match(/([\d.]+)\s*m/);
      if (treffer) {
        var meter = parseInt(treffer[1].replace(/\./g, ''), 10);
        if (isFinite(meter)) hoehen.push(meter);
      }
    });

    var werte = {
      touren: zeilen.length,
      hm: summeHm,
      gipfel: hoehen.length ? Math.max.apply(null, hoehen) : null
    };
    document.querySelectorAll('[data-zahl]').forEach(function (el) {
      var wert = werte[el.dataset.zahl];
      if (wert == null) return;
      // data-count treibt das Count-up, das gleich danach laeuft
      el.dataset.count = String(wert);
    });
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

  /* ---------- Wegverlauf ----------
     `data-route="lat,lon lat,lon …"` am SVG ist die EINZIGE Quelle, genau wie
     data-punkte beim Profil. Die statischen Pfade im HTML sind der Fallback
     ohne JS; hier werden sie aus denselben Daten neu gerechnet.

     Die Projektion MUSS die aus scripts/route-einbauen.py sein — sonst springt
     die Linie beim Laden sichtbar um. Beide rechnen: x nach Osten, y nach
     Sueden, Mittelpunkt in die Mitte der viewBox. */
  (function () {
    var route = document.querySelector('.tour-route');
    if (!route) return;

    var svg = route.querySelector('.tour-route__svg');
    var weg = route.querySelector('.tour-route__weg');
    if (!svg || !weg) return;

    var roh = (svg.getAttribute('data-route') || '').trim();
    if (!roh) return;
    var punkte = roh.split(/\s+/).map(function (p) {
      var t = p.split(',');
      return [parseFloat(t[0]), parseFloat(t[1])];
    }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
    if (punkte.length < 2) return;

    var kasten = (svg.getAttribute('viewBox') || '0 0 900 600').split(/\s+/).map(Number);
    var kBreite = kasten[2], kHoehe = kasten[3];

    /* --- Projektion, gleiche Formeln wie im Bau-Skript --- */
    var lat0 = punkte.reduce(function (a, p) { return a + p[0]; }, 0) / punkte.length;
    var k = Math.cos(lat0 * Math.PI / 180);
    var xy = punkte.map(function (p) {
      return [(p[1] - punkte[0][1]) * 111320 * k, -(p[0] - punkte[0][0]) * 111320];
    });

    var xs = xy.map(function (p) { return p[0]; });
    var ys = xy.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var breiteM = Math.max(maxX - minX, 1), hoeheM = Math.max(maxY - minY, 1);
    var rand = Math.max(breiteM, hoeheM) * 0.09;
    breiteM += 2 * rand; hoeheM += 2 * rand;
    if (hoeheM / breiteM > 1.00) breiteM = hoeheM / 1.00;
    else if (hoeheM / breiteM < 0.46) hoeheM = breiteM * 0.46;

    var mitteX = (maxX + minX) / 2, mitteY = (maxY + minY) / 2;
    var skala = kBreite / breiteM;
    var px = xy.map(function (p) {
      return [(p[0] - mitteX) * skala + kBreite / 2,
              (p[1] - mitteY) * skala + kHoehe / 2];
    });

    /* --- Pfad: leicht geglaettet, damit es nach Weg aussieht und nicht nach
           Rohdaten (identisch zu bogen() im Bau-Skript) --- */
    function pfad(p) {
      if (p.length < 3) return 'M' + p.map(function (q) { return q[0] + ',' + q[1]; }).join(' L');
      var teile = ['M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1)];
      for (var i = 1; i < p.length - 1; i++) {
        teile.push('Q' + p[i][0].toFixed(1) + ',' + p[i][1].toFixed(1) + ' '
          + ((p[i][0] + p[i + 1][0]) / 2).toFixed(1) + ','
          + ((p[i][1] + p[i + 1][1]) / 2).toFixed(1));
      }
      teile.push('L' + p[p.length - 1][0].toFixed(1) + ',' + p[p.length - 1][1].toFixed(1));
      return teile.join(' ');
    }

    var d = pfad(px);
    weg.setAttribute('d', d);
    var schatten = route.querySelector('.tour-route__schatten');
    if (schatten) schatten.setAttribute('d', d);

    var start = route.querySelector('.tour-route__start');
    if (start) {
      start.setAttribute('cx', px[0][0].toFixed(1));
      start.setAttribute('cy', px[0][1].toFixed(1));
    }
    var gipfel = route.querySelector('.tour-route__gipfel');

    /* Der Gipfel ist NICHT einfach der letzte Punkt. Bei einer aufgezeichneten
       Rundtour endet die Spur wieder am Parkplatz — das Kreuz sass dann auf
       dem Startpunkt, waehrend das gebaute HTML es richtig hatte und tour.js
       es beim Laden ueberschrieb. Die Koordinate steht deshalb als
       `data-gipfel` am SVG; ohne sie bleibt es beim letzten Punkt. */
    var gipfelOrt = (svg.getAttribute('data-gipfel') || '').split(',').map(Number);
    var letzter = px[px.length - 1];
    if (gipfelOrt.length === 2 && isFinite(gipfelOrt[0]) && isFinite(gipfelOrt[1])) {
      var naechster = 0, besterAbstand = Infinity;
      for (var gi = 0; gi < punkte.length; gi++) {
        var ab = meter(punkte[gi], gipfelOrt);
        if (ab < besterAbstand) { besterAbstand = ab; naechster = gi; }
      }
      letzter = px[naechster];
    }
    if (gipfel) {
      gipfel.setAttribute('d',
        'M' + letzter[0].toFixed(1) + ',' + (letzter[1] + 9).toFixed(1)
        + ' V' + (letzter[1] - 13).toFixed(1)
        + ' M' + (letzter[0] - 7).toFixed(1) + ',' + (letzter[1] - 6).toFixed(1)
        + ' H' + (letzter[0] + 7).toFixed(1));
    }

    /* Schilder sitzen als HTML ueber der Karte, also in Prozent nachfuehren. */
    function schild(waehler, p) {
      var el = route.querySelector(waehler);
      if (!el) return;
      var ax = p[0] / kBreite, ay = p[1] / kHoehe;
      el.style.left = (ax * 100).toFixed(1) + '%';
      el.style.top = (ay * 100).toFixed(1) + '%';
      /* Am Rand nicht zentrieren, sonst laeuft der Name aus dem Bild —
         gleiche Regel wie anker() in scripts/route-einbauen.py. */
      el.style.transform = 'translate('
        + (ax > 0.66 ? '-100%' : ax < 0.34 ? '0' : '-50%') + ', '
        + (ay < 0.16 ? '120%' : '-190%') + ')';
    }
    schild('.tour-route__schild--start', px[0]);
    schild('.tour-route__schild--gipfel', letzter);

    /* --- Strecke an jedem Punkt, fuer Kilometermarken und Ablesen --- */
    function meter(a, b) {
      var breite = (a[0] + b[0]) / 2 * Math.PI / 180;
      return Math.hypot((b[0] - a[0]) * 111320,
                        (b[1] - a[1]) * 111320 * Math.cos(breite));
    }
    var summe = [0];
    for (var i = 1; i < punkte.length; i++) {
      summe.push(summe[i - 1] + meter(punkte[i - 1], punkte[i]) / 1000);
    }
    var gesamt = summe[summe.length - 1];

    var marken = route.querySelector('.tour-route__kms');
    if (marken) {
      var schritt = gesamt <= 12 ? 1 : 2;
      marken.textContent = '';
      for (var ziel = schritt; ziel < gesamt; ziel += schritt) {
        for (var j = 1; j < summe.length; j++) {
          if (summe[j] < ziel) continue;
          var t = (ziel - summe[j - 1]) / ((summe[j] - summe[j - 1]) || 1);
          var mx = px[j - 1][0] + (px[j][0] - px[j - 1][0]) * t;
          var my = px[j - 1][1] + (px[j][1] - px[j - 1][1]) * t;
          /* Eine Marke direkt auf Start oder Gipfel verdeckt genau den
             Punkt, auf den es ankommt — die 8 lag auf dem Gipfelkreuz. */
          var zuNah = Math.hypot(mx - px[0][0], my - px[0][1]) < 26
            || Math.hypot(mx - letzter[0], my - letzter[1]) < 26;
          if (zuNah) break;
          var kreis = document.createElementNS(SVG_NS, 'circle');
          kreis.setAttribute('class', 'tour-route__km');
          kreis.setAttribute('cx', mx.toFixed(1));
          kreis.setAttribute('cy', my.toFixed(1));
          kreis.setAttribute('r', '4.5');
          var text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('class', 'tour-route__kmtext');
          text.setAttribute('x', mx.toFixed(1));
          text.setAttribute('y', (my - 11).toFixed(1));
          text.textContent = ziel;
          marken.appendChild(kreis);
          marken.appendChild(text);
          break;
        }
      }
    }

    /* --- Ablesen: naechster Punkt auf der Route zum Finger. Zeigt Strecke und,
           wenn das Hoehenprofil auf derselben Seite steht, die Hoehe dort. --- */
    var wert = route.querySelector('.tour-route__wert');
    var profilPunkte = null;
    var profilSvg = document.querySelector('.tour-profil .tour-svg');
    if (profilSvg && profilSvg.getAttribute('data-punkte')) {
      profilPunkte = profilSvg.getAttribute('data-punkte').trim().split(/\s+/)
        .map(function (p) { var t = p.split(','); return [parseFloat(t[0]), parseFloat(t[1])]; });
    }

    function hoeheBei(km) {
      if (!profilPunkte) return null;
      for (var i = 1; i < profilPunkte.length; i++) {
        if (profilPunkte[i][0] < km) continue;
        var spanne = profilPunkte[i][0] - profilPunkte[i - 1][0] || 1;
        var t = (km - profilPunkte[i - 1][0]) / spanne;
        return profilPunkte[i - 1][1] + (profilPunkte[i][1] - profilPunkte[i - 1][1]) * t;
      }
      return profilPunkte[profilPunkte.length - 1][1];
    }

    if (wert) {
      svg.addEventListener('pointermove', function (e) {
        var mass = svg.getBoundingClientRect();
        var zx = (e.clientX - mass.left) / mass.width * kBreite;
        var zy = (e.clientY - mass.top) / mass.height * kHoehe;

        var beste = 0, bestAbstand = Infinity;
        for (var i = 0; i < px.length; i++) {
          var dd = (px[i][0] - zx) * (px[i][0] - zx) + (px[i][1] - zy) * (px[i][1] - zy);
          if (dd < bestAbstand) { bestAbstand = dd; beste = i; }
        }
        /* Nur ablesen, wenn der Finger halbwegs auf dem Weg liegt — sonst
           zeigt die Karte irgendeinen Wert fuer eine leere Flaeche an. */
        if (Math.sqrt(bestAbstand) > kBreite * 0.09) { route.classList.remove('liest'); return; }

        var km = summe[beste];
        var hoehe = hoeheBei(km);
        wert.innerHTML = '<b>' + km.toFixed(1).replace('.', ',') + ' km</b>'
          + (hoehe ? ' · ' + Math.round(hoehe).toLocaleString('de-DE') + ' m' : '');
        wert.style.left = (px[beste][0] / kBreite * 100).toFixed(1) + '%';
        wert.style.top = (px[beste][1] / kHoehe * 100).toFixed(1) + '%';
        route.classList.add('liest');
      });
      ['pointerleave', 'pointercancel'].forEach(function (n) {
        svg.addEventListener(n, function () { route.classList.remove('liest'); });
      });
      window.addEventListener('blur', function () { route.classList.remove('liest'); });
    }

    /* --- Aufziehen beim Sichtbarwerden, wie beim Profil --- */
    if (!('IntersectionObserver' in window) || sanftBevorzugt) {
      route.classList.add('in');
    } else {
      var beob = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          if (e.isIntersecting) { route.classList.add('in'); beob.disconnect(); }
        });
      }, { rootMargin: '0px 0px -15% 0px' });
      beob.observe(route);
    }
  })();

})();
