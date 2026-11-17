/* Radarschirm: dieselben Treffer wie die Liste, als Lichter rund um die Mitte (Sebi 17.11.2026, Richtung A mit Ortsnamen).
   Oben ist Norden, die Ringe zeigen die Entfernung. Der Radius wächst mit der Wurzel der Entfernung:
   in Städten liegen viele Märkte innerhalb von zwei Kilometern, so stapeln sie sich nicht auf einem Fleck.
   Es wird nichts nachgeladen: keine Kacheln, kein fremder Server, gezeichnet aus den Daten der Suche.
   Bedienung: Licht antippen (Zeiger) oder mit den zwei Pfeilen von nah nach fern gehen (Tastatur, Vorlesegerät). */
(function () {
  'use strict';
  var EN = document.documentElement.lang === 'en', NS = 'http://www.w3.org/2000/svg';
  var R = 140, RAND = 166, RINGE = { 10: [1, 4, 10], 25: [2, 10, 25], 50: [5, 20, 50], 100: [10, 40, 100] };
  var ORTE_MAX = 7, ORT_AB = .22, ORT_LANG = 18, ZEICHEN = 7, VIELE = 120, HIER_KM = .1;
  var T = EN ? {
    titel: function (n, km, ort) { return 'Radar screen: ' + (n === 1 ? '1 market' : n + ' markets') + ' within ' + km + ' km' + (ort ? ' of ' + ort : ''); },
    richtung: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'], nach: ' to the ', hier: 'right here',
    offen: 'Date not confirmed yet', du: 'you', von: ' of ', warm: 'with a 2026 date', kalt: 'date still open',
    warmTag: function (d) { return 'open on ' + d; }, kaltTag: 'closed that day or no date'
  } : {
    titel: function (n, km, ort) { return 'Radarschirm: ' + (n === 1 ? '1 Markt' : n + ' Märkte') + ' im Umkreis von ' + km + ' km' + (ort ? ' um ' + ort : ''); },
    richtung: ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'], nach: ' Richtung ', hier: 'direkt hier',
    offen: 'Termin noch nicht bestätigt', du: 'du', von: ' von ', warm: 'mit Termin 2026', kalt: 'Termin noch offen',
    warmTag: function (d) { return 'am ' + d + ' offen'; }, kaltTag: 'an dem Tag zu oder ohne Termin'
  };

  function s(name, attr, text) { var e = document.createElementNS(NS, name); for (var k in attr) e.setAttribute(k, attr[k]); if (text != null) e.textContent = text; return e; }
  function h(name, klasse, text) { var e = document.createElement(name); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; }
  function z(n) { return Math.round(n * 10) / 10; }
  function rad(km, weite) { return R * Math.sqrt(Math.min(km, weite) / weite); }
  /* Winkel aus dem Kartenbild (Ost-West mit dem Breitengrad gestaucht), Abstand aus der Entfernung der Liste */
  function lage(mitte, m, km, weite) {
    var w = Math.atan2((m.lon - mitte[1]) * Math.cos(mitte[0] * Math.PI / 180), m.lat - mitte[0]), r = rad(km, weite);
    return { x: z(Math.sin(w) * r), y: z(-Math.cos(w) * r), w: (w + 2 * Math.PI) % (2 * Math.PI) };
  }

  function grund(svg, weite) {
    var d = s('defs'), g = s('radialGradient', { id: 'wm-glut' });
    g.append(s('stop', { offset: 0, 'stop-color': '#ffd98a', 'stop-opacity': .95 }), s('stop', { offset: .35, 'stop-color': '#f1a53a', 'stop-opacity': .45 }), s('stop', { offset: 1, 'stop-color': '#f1a53a', 'stop-opacity': 0 }));
    d.append(g); svg.append(d);
    var ringe = RINGE[weite] || [weite * .08, weite * .4, weite], innen = rad(ringe[0], weite), zahlen = s('g'), kaesten = [];
    for (var w = 0; w < 360; w += 15) {
      var a = w * Math.PI / 180, lang = w % 45 ? 5 : 10, sx = Math.sin(a), cy = -Math.cos(a);
      if (!(w % 45)) svg.append(s('line', { class: 'wm-s-speiche', x1: z(sx * innen), y1: z(cy * innen), x2: z(sx * R), y2: z(cy * R) }));
      if (w) svg.append(s('line', { class: 'wm-s-strich', x1: z(sx * (R + 5)), y1: z(cy * (R + 5)), x2: z(sx * (R + 5 + lang)), y2: z(cy * (R + 5 + lang)) }));
    }
    ringe.forEach(function (km) {
      svg.append(s('circle', { class: 'wm-s-ring' + (km === weite ? ' wm-s-ring--aussen' : ''), r: z(rad(km, weite)) }));
      /* der innerste Ring trägt seine Zahl außen: innen liegen die nächsten Märkte */
      var y = z(-rad(km, weite) + (km === ringe[0] ? -5 : 14)), wort = km + ' km';
      zahlen.append(s('text', { class: 'wm-s-km', x: 5, y: y }, wort)); kaesten.push([5, y - 11, 5 + wort.length * ZEICHEN, y + 4]);
    });
    svg.append(s('text', { class: 'wm-s-nord', x: 0, y: -(R + 9), 'text-anchor': 'middle' }, 'N'));
    svg.append(s('path', { class: 'wm-strahl', d: 'M0 0 L0 ' + -R + ' A' + R + ' ' + R + ' 0 0 0 ' + z(-R * Math.sin(.6)) + ' ' + z(-R * Math.cos(.6)) + ' Z' }));
    return { zahlen: zahlen, kaesten: kaesten };   /* die Ringzahlen liegen später über den Lichtern, Ortsnamen weichen ihnen aus */
  }

  function licht(p, i, glut) {
    var g = s('g', { class: 'wm-licht' + (p.liste > -1 ? ' wm-licht--warm' : ''), 'data-i': i });
    g.style.setProperty('--w', (p.lage.w / (2 * Math.PI)).toFixed(3));
    g.append(s('title', {}, p.m.name));
    if (p.liste > -1) g.append(s('circle', { class: 'wm-s-glut', cx: p.lage.x, cy: p.lage.y, r: glut, fill: 'url(#wm-glut)' }));
    g.append(s('circle', { class: 'wm-s-kern', cx: p.lage.x, cy: p.lage.y, r: p.liste > -1 ? 3.2 : 2.4 }), s('circle', { cx: p.lage.x, cy: p.lage.y, r: 13, fill: 'transparent' }));
    return g;
  }

  /* Ortsnamen als Halt: je Ort außerhalb der Mitte einmal, am nächsten Markt; was sich überdeckt oder über den Rand ragt, entfällt */
  function ortsnamen(d, belegt) {
    var je = {}, g = s('g', { class: 'wm-s-orte' }), gesetzt = [[-30, -12, 30, 12]].concat(belegt), frei = gesetzt.length + ORTE_MAX;
    d.punkte.forEach(function (p) {
      var o = p.m.ort; if (!o || o === d.ort || o.length > ORT_LANG || p.km < d.weite * ORT_AB) return;
      if (je[o]) je[o].n++; else je[o] = { p: p, n: 1, name: o };
    });
    Object.keys(je).map(function (k) { return je[k]; }).sort(function (a, b) { return b.n - a.n || a.p.km - b.p.km; }).forEach(function (o) {
      if (gesetzt.length >= frei) return;
      var b = o.name.length * ZEICHEN, links = o.p.lage.x > 20, x = o.p.lage.x + (links ? -9 : 9), y = o.p.lage.y + 4;
      var k = [links ? x - b : x, y - 12, links ? x : x + b, y + 5];
      if (Math.max(Math.hypot(k[0], k[1]), Math.hypot(k[0], k[3]), Math.hypot(k[2], k[1]), Math.hypot(k[2], k[3])) > RAND) return;
      if (gesetzt.some(function (a) { return k[0] < a[2] + 4 && k[2] > a[0] - 4 && k[1] < a[3] + 2 && k[3] > a[1] - 2; })) return;
      gesetzt.push(k); g.append(s('text', { x: z(x), y: z(y), 'text-anchor': links ? 'end' : 'start' }, o.name));
    });
    return g;
  }

  window.wmSchirm = function (wurzel, hilfe) {
    var svg = wurzel.querySelector('svg'), text = wurzel.querySelector('.wm-z-text'), vor = wurzel.querySelector('.wm-z-vor'), weiter = wurzel.querySelector('.wm-z-weiter'),
      zahl = wurzel.querySelector('.wm-z-zahl'), zeige = wurzel.querySelector('.wm-z-zeige'), legende = wurzel.querySelector('.wm-legende');
    var stand = null, gewaehlt = 0, ring = null;

    function waehle(i) {
      var p = stand.punkte[i]; if (!p) return;
      gewaehlt = i; ring.setAttribute('cx', p.lage.x); ring.setAttribute('cy', p.lage.y);
      var wo = p.km < HIER_KM ? T.hier : hilfe.entf(p.km) + T.nach + T.richtung[Math.round(p.lage.w / (Math.PI / 4)) % 8];
      text.replaceChildren(h('b', '', p.m.name), h('span', '', (p.m.ort ? p.m.ort + ' · ' : '') + wo),
        p.m.termine.length ? hilfe.wann(p.m, h('span', 'wm-z-wann')) : h('span', '', T.offen));
      zahl.textContent = (i + 1) + T.von + stand.punkte.length;
      vor.disabled = i === 0; weiter.disabled = i === stand.punkte.length - 1; zeige.hidden = p.liste < 0;
    }

    function fahrt() { wurzel.classList.remove('wm-fahrt'); void wurzel.offsetWidth; wurzel.classList.add('wm-fahrt'); }

    /* d: { punkte: [{ m, km, liste }] von nah nach fern, weite, mitte: [lat, lon], ort, du, tag, neu, ruhig } · liste = Platz in der Liste oder -1 */
    function zeichne(d) {
      var alt = stand && stand.punkte[gewaehlt] ? stand.punkte[gewaehlt].m : null;
      stand = d; wurzel.hidden = !d.punkte.length; wurzel.classList.remove('wm-fahrt');
      if (!d.punkte.length) return;
      svg.textContent = ''; svg.setAttribute('aria-label', T.titel(d.punkte.length, d.weite, d.ort));
      var boden = grund(svg, d.weite);
      var kalt = s('g'), warm = s('g'), glut = d.punkte.length > VIELE ? 7 : 11, hatKalt = false, hatWarm = false, start = -1;
      d.punkte.forEach(function (p) { p.lage = lage(d.mitte, p.m, p.km, d.weite); });
      for (var i = d.punkte.length - 1; i >= 0; i--) {              /* fern zuerst: der nähere Markt liegt oben und nimmt den Tipp */
        var p = d.punkte[i]; (p.liste > -1 ? warm : kalt).append(licht(p, i, glut));
        if (p.liste > -1) { hatWarm = true; start = i; } else hatKalt = true;
        if (!d.neu && p.m === alt) gewaehlt = i;
      }
      ring = s('circle', { class: 'wm-s-wahl', r: 8 });
      var mitte = s('g', { class: 'wm-s-mitte' }); mitte.append(s('circle', { r: 3 }));
      if (d.du) mitte.append(s('text', { x: 7, y: 4 }, T.du));
      svg.append(kalt, warm, boden.zahlen, ortsnamen(d, boden.kaesten), mitte, ring);
      legende.replaceChildren();
      if (hatWarm) legende.append(h('span', 'wm-l-warm', d.tag ? T.warmTag(d.tag) : T.warm));
      if (hatKalt) legende.append(h('span', 'wm-l-kalt', d.tag ? T.kaltTag : T.kalt));
      waehle(d.neu || !d.punkte[gewaehlt] || d.punkte[gewaehlt].m !== alt ? Math.max(start, 0) : gewaehlt);
      if (d.neu && !d.ruhig) fahrt();
    }

    svg.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('.wm-licht'); if (l) waehle(+l.getAttribute('data-i')); });
    vor.addEventListener('click', function () { waehle(gewaehlt - 1); });
    weiter.addEventListener('click', function () { waehle(gewaehlt + 1); });
    zeige.addEventListener('click', function () { var p = stand && stand.punkte[gewaehlt]; if (p && p.liste > -1) hilfe.zeige(p.liste); });
    return { zeichne: zeichne, fahrt: fahrt };
  };
})();
