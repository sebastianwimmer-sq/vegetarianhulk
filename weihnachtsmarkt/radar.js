/* Weihnachtsmarkt-Radar: Suche nach Postleitzahl, Umkreis, Art und Tag.
   Die Postleitzahl bleibt im Browser: Koordinaten kommen aus plz.json, gerechnet wird hier.
   Texte je Sprache über <html lang> (DE/EN sind dieselbe Fläche, eigener Wortlaut). */
(function () {
  'use strict';
  var EN = document.documentElement.lang === 'en';
  var DATEN = '/weihnachtsmarkt/daten/';
  var RUECKMELDUNG = 'https://vh-forms.peaking.workers.dev/radar/rueckmeldung';
  var KONTAKT = 'info@vegetarianhulk.de';
  var JE_SEITE = 12, TAGE_VORAUS = 28, AUFTAKT_ZEILEN = 6;
  var T = EN ? {
    wt: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], woche: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    bis: ' to ', plzFalsch: 'A German postcode has five digits. Please check yours.', plzFremd: 'We don’t know this postcode. Please check the five digits.',
    laden: 'Could not load the markets. Please check your connection and tap “Search” again.',
    alle: 'all', tage: 'days', offen: ' open', zu: 'none', maerkte: ' markets', einMarkt: '1 market',
    zahlAlle: function (n, o) { return (n === 1 ? '1 market' : n + ' markets') + (o ? ' around ' + o : ' near you'); },
    unter: function (k) { return 'Within ' + k + ' km, nearest first'; },
    vertrauen: function (s) { return zahl(s.bestaetigt) + ' markets with a confirmed 2026 date. Updated ' + datumLang(s.gebaut) + '.'; },
    zahlTag: function (d, n) { return n === 1 ? '1 market is open on ' + d : n + ' markets are open on ' + d; },
    keinTag: function (d) { return 'No market we know is open on ' + d; },
    keiner: 'We don’t know a market for this choice yet. Try a wider radius or fewer filters.',
    heute: 'Open today', morgen: 'Starts tomorrow', inTagen: function (n) { return 'Starts in ' + n + ' days'; },
    veranstalter: 'Organiser', veranstalterLang: 'Open the organiser’s page', karte: 'Map', karteLang: 'Show on the map', zeiten: 'Opening hours: ', zeitenOsm: 'Opening hours (OpenStreetMap): ',
    quelle: 'Source: ', lizenz: 'Licence', geprueft: 'checked ', seiteVeranstalter: 'organiser’s page', mehr: 'Show more',
    ohneTermin: function (n) { return n === 1 ? '1 more market without a confirmed 2026 date' : n + ' more markets without a confirmed 2026 date'; },
    stand: function (s) { return zahl(s.maerkte) + ' markets in Germany and just across the Austrian border, ' + zahl(s.bestaetigt) + ' with a confirmed 2026 date. Last update ' + datumLang(s.gebaut) + '. Dates as stated by the sources, without guarantee. Location data © OpenStreetMap contributors. Dates: open data of the German tourism boards via the German National Tourist Board, City of Essen, and the organisers’ pages.'; },
    vorbei: 'The season is over. The radar is back in November.',
    funkenAn: 'Pause snow', funkenAus: 'Resume snow',
    bescheid: { dabei: 'You are in. I will write when something happens on the radar.', 'anmeldung-abgelaufen': 'The link from the email has expired. Just sign up again.', 'anmeldung-fehler': 'Signing up did not work. Please try again or write to ' }, laeuft: 'Open now', ab: 'from ',
    arten: { christkindl: 'Christkindlmarkt', advent: 'Advent market', wald: 'Forest, mountain, castle', mittelalter: 'Medieval', nikolaus: 'St Nicholas', kurz: 'One weekend', lang: 'All Advent' },
    danke: 'Thank you, that reached me.', sendeFehler: 'Could not send. Please try again, or write to ', pflichtText: 'Please write a few words about what was missing.',
    sterneLabel: function (n) { return n + ' of 5 cinnamon stars'; }
  } : {
    wt: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], woche: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], mon: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
    bis: ' bis ', plzFalsch: 'Eine Postleitzahl hat fünf Ziffern. Schau bitte nochmal drauf.', plzFremd: 'Diese Postleitzahl kennen wir nicht. Prüf bitte die fünf Ziffern.',
    laden: 'Die Märkte konnten nicht geladen werden. Prüf deine Verbindung und tipp nochmal auf „Suchen“.',
    alle: 'alle', tage: 'Tage', offen: ' offen', zu: 'keiner', maerkte: ' Märkte', einMarkt: '1 Markt',
    zahlAlle: function (n, o) { return (n === 1 ? '1 Markt' : n + ' Märkte') + (o ? ' rund um ' + o : ' in deinem Umkreis'); },
    unter: function (k) { return 'Im Umkreis von ' + k + ' km, der nächste zuerst'; },
    vertrauen: function (s) { return zahl(s.bestaetigt) + ' Märkte mit bestätigtem Termin 2026. Stand ' + datumLang(s.gebaut) + '.'; },
    zahlTag: function (d, n) { return n === 1 ? d + ' hat ein Markt offen' : d + ' haben ' + n + ' Märkte offen'; },
    keinTag: function (d) { return d + ' hat kein Markt offen, den wir kennen'; },
    keiner: 'Dazu kennen wir noch keinen Markt. Nimm einen größeren Umkreis oder weniger Filter.',
    heute: 'Heute offen', morgen: 'Startet morgen', inTagen: function (n) { return 'Startet in ' + n + ' Tagen'; },
    veranstalter: 'Veranstalter', veranstalterLang: 'Seite des Veranstalters öffnen', karte: 'Karte', karteLang: 'Auf der Karte zeigen', zeiten: 'Öffnungszeiten: ', zeitenOsm: 'Öffnungszeiten (OpenStreetMap): ',
    quelle: 'Quelle: ', lizenz: 'Lizenz', geprueft: 'geprüft am ', seiteVeranstalter: 'Seite des Veranstalters', mehr: 'Mehr zeigen',
    ohneTermin: function (n) { return n === 1 ? '1 weiterer Markt ohne bestätigten Termin 2026' : n + ' weitere Märkte ohne bestätigten Termin 2026'; },
    stand: function (s) { return zahl(s.maerkte) + ' Märkte in Deutschland und im grenznahen Österreich, ' + zahl(s.bestaetigt) + ' mit bestätigtem Termin 2026. Stand ' + datumLang(s.gebaut) + '. Termine laut Quelle, ohne Gewähr. Ortsdaten © OpenStreetMap-Mitwirkende. Termine: offene Daten der Tourismusverbände über die Deutsche Zentrale für Tourismus, Stadt Essen und die Seiten der Veranstalter.'; },
    vorbei: 'Die Saison ist vorbei. Im November ist der Radar wieder da.',
    funkenAn: 'Schnee anhalten', funkenAus: 'Schnee weiter',
    bescheid: { dabei: 'Du bist dabei. Ich melde mich, wenn sich am Radar etwas tut.', 'anmeldung-abgelaufen': 'Der Link aus der Mail ist abgelaufen. Trag dich einfach nochmal ein.', 'anmeldung-fehler': 'Das Eintragen hat nicht geklappt. Versuch es nochmal oder schreib an ' }, laeuft: 'Jetzt offen', ab: 'ab ',
    arten: { christkindl: 'Christkindlmarkt', advent: 'Adventsmarkt', wald: 'Wald, Berg und Burg', mittelalter: 'Mittelalter', nikolaus: 'Nikolaus', kurz: 'Nur ein Wochenende', lang: 'Ganze Adventszeit' },
    danke: 'Danke dir, das ist bei mir angekommen.', sendeFehler: 'Das Senden hat nicht geklappt. Versuch es nochmal oder schreib an ', pflichtText: 'Schreib bitte kurz dazu, was gefehlt hat.',
    sterneLabel: function (n) { return n + ' von 5 Zimtsternen'; }
  };
  var ART_MUSTER = [['christkindl', /christkindl/i], ['advent', /advent/i], ['wald', /wald|berg|burg|schloss|\balm\b|hütte/i],
    ['mittelalter', /mittelalter|histor|ritter/i], ['nikolaus', /nikolaus/i]];
  var OSM_ZEIT = [[/\bTu\b/g, 'Di'], [/\bWe\b/g, 'Mi'], [/\bTh\b/g, 'Do'], [/\bSu\b/g, 'So'], [/\bPH\b/g, 'Feiertag'], [/\boff\b/g, 'zu'], [/\bDec\b/g, 'Dez']];
  var ZIMTSTERN = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#8f5a2e"><polygon points="20,2 35.6,29 4.4,29"/><polygon points="20,38 4.4,11 35.6,11"/></g>' +
    '<g class="wm-guss" fill="#fff6e6" transform="translate(20 20) scale(.72) translate(-20 -20)"><polygon points="20,2 35.6,29 4.4,29"/><polygon points="20,38 4.4,11 35.6,11"/></g></svg>';

  var $ = function (s, w) { return (w || document).querySelector(s); };
  var seite = $('.wm-seite'), form = $('#wm-form'), eingabe = $('#wm-plz'), fehler = $('.wm-fehler'), tageEl = $('.wm-tage'),
    zahlEl = $('.wm-zahl'), unterEl = $('.wm-zahl-unter'), liste = $('.wm-liste'), offenEl = $('.wm-offen'), standEl = $('.wm-stand'), artenEl = $('#wm-arten'), chipsEl = $('#wm-arten .wm-chips'),
    arbeit = $('.wm-arbeit'), auftaktEl = $('.wm-auftakt'), aufListe = $('.wm-auf-liste'), spanneEl = $('.wm-spanne'), vertrauenEl = $('.wm-vertrauen'), rueck = $('.wm-rueck'), trefferEl = $('.wm-treffer'), reihe = $('.wm-reihe'), umschalt = $('.wm-umschalt');
  if (!seite || !form) return;
  var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var daten = null, laedt = null, zustand = { plz: '', km: 25, arten: [], tag: '', gezeigt: JE_SEITE, ort: null };

  /* Adressen kommen aus fremden Daten: nur http(s) wird ein Link, alles andere bleibt Text. */
  function sicher(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function el(name, klasse, text) { var e = document.createElement(name); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; }
  function zahl(n) { return Number(n).toLocaleString(EN ? 'en-GB' : 'de-DE'); }
  function tag(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function kurz(d) { return EN ? T.wt[d.getDay()] + ' ' + d.getDate() + ' ' + T.mon[d.getMonth()] : T.wt[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function datumLang(s) { var d = tag(s); return EN ? d.getDate() + ' ' + T.mon[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); }
  /* Termin als Teile, die nie mitten im Datum umbrechen: „Fr 27.11.“ · „bis So 20.12.“ */
  function wann(m, ziel) {
    m.termine.forEach(function (r, i) {
      ziel.append(el('span', 'wm-nw', (i ? ', ' : '') + kurz(tag(r[0]))));
      if (r[0] !== r[1]) ziel.append(' ', el('span', 'wm-nw', T.bis.trim() + ' ' + kurz(tag(r[1]))));
    });
    return ziel;
  }
  function offenAm(m, s) { return m.termine.some(function (r) { return r[0] <= s && s <= r[1]; }); }
  function heute() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function km(a, b) {
    var r = Math.PI / 180, p1 = a[0] * r, p2 = b.lat * r, h = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((b.lon - a[1]) * r / 2), 2);
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function entf(k) { return (k < 10 ? (Math.round(k * 10) / 10).toFixed(1).replace('.', EN ? '.' : ',') : Math.round(k)) + ' km'; }
  function artenVon(m) {
    var aus = ART_MUSTER.filter(function (p) { return p[1].test(m.name); }).map(function (p) { return p[0]; });
    var tageZahl = (m.termine || []).reduce(function (s, r) { return s + Math.round((tag(r[1]) - tag(r[0])) / 864e5) + 1; }, 0);
    if (tageZahl && tageZahl <= 3) aus.push('kurz');
    if (tageZahl >= 14) aus.push('lang');
    return aus;
  }

  function lade() {
    if (daten) return Promise.resolve(daten);
    if (laedt) return laedt;
    return laedt = Promise.all(['maerkte.json', 'plz.json', 'stand.json'].map(function (f) {
      return fetch(DATEN + f).then(function (a) { if (!a.ok) throw new Error(f); return a.json(); });
    })).then(function (d) {
      var h = iso(heute());
      d[0].forEach(function (m) { m.termine = m.termine || []; m.arten = artenVon(m); });
      laedt = null; daten = { maerkte: d[0].filter(function (m) { return m.status !== 'bestaetigt' || m.termine.some(function (r) { return r[1] >= h; }); }), plz: d[1], stand: d[2] };
      return daten;
    }).catch(function (e) { laedt = null; throw e; });   /* nach einem Fehler darf der nächste Versuch neu laden */
  }

  function imUmkreis() {
    return daten.maerkte.map(function (m) { return { m: m, km: km(zustand.ort, m) }; })
      .filter(function (t) { return t.km <= zustand.km; }).sort(function (a, b) { return a.km - b.km; });
  }
  function ortsname() { return String(zustand.ort[2] || '').replace(/\s*[,(].*$/, ''); }
  function passtArt(t) { return !zustand.arten.length || zustand.arten.some(function (a) { return t.m.arten.indexOf(a) > -1; }); }

  /* Radarschirm (schirm.js): dieselben Treffer als Lichter. Schmal ersetzt er auf Wunsch die Liste, breit steht er über ihr. */
  function ansicht(a) {
    trefferEl.setAttribute('data-ansicht', a); umschalt.setAttribute('aria-pressed', String(a === 'schirm'));
    if (a === 'schirm' && !ruhig) schirm.fahrt();
  }
  function zeigeInListe(i) {
    if (i >= zustand.gezeigt) { zustand.gezeigt = Math.ceil((i + 1) / JE_SEITE) * JE_SEITE; zeichne(false); }
    ansicht('liste');
    var k = liste.children[i]; if (!k || !k.classList.contains('wm-karte')) return;
    liste.querySelectorAll('.wm-gezeigt').forEach(function (x) { x.classList.remove('wm-gezeigt'); });
    k.classList.add('wm-gezeigt'); k.tabIndex = -1; k.focus({ preventScroll: true }); k.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' });
  }
  var schirm = window.wmSchirm($('.wm-schirm'), { entf: entf, wann: wann, zeige: zeigeInListe });
  umschalt.addEventListener('click', function () { ansicht(trefferEl.getAttribute('data-ansicht') === 'schirm' ? 'liste' : 'schirm'); });

  function karte(t, i) {
    var m = t.m, k = el('article', 'wm-karte'), kopf = el('div', 'wm-k-kopf'), zeit = el('div', 'wm-k-zeit'), h = iso(heute());
    kopf.append(el('h3', '', m.name), el('span', 'wm-km', entf(t.km)));
    zeit.append(wann(m, el('p', 'wm-wann')));
    var naechster = m.termine.filter(function (r) { return r[1] >= h; })[0];
    if (naechster) {
      var bis = Math.round((tag(naechster[0]) - heute()) / 864e5), jetzt = el('p', 'wm-jetzt' + (bis <= 0 ? ' wm-heute' : ''));
      if (bis <= 0) jetzt.innerHTML = ZIMTSTERN;
      jetzt.append(bis <= 0 ? T.heute : bis === 1 ? T.morgen : T.inTagen(bis)); zeit.append(jetzt);
    }
    var fuss = el('div', 'wm-k-fuss'); fuss.append(zeit);
    k.append(kopf, el('p', 'wm-ort', m.platz && m.platz !== m.ort ? m.ort + ', ' + m.platz : m.ort), fuss);
    if (m.zeiten) {
      var z = m.zeiten; if (m.quelle === 'osm' && !EN) OSM_ZEIT.forEach(function (p) { z = z.replace(p[0], p[1]); });
      k.append(el('p', '', (m.quelle === 'osm' ? T.zeitenOsm : T.zeiten) + z));
    }
    var wege = el('p', 'wm-wege');
    if (sicher(m.link)) { var a = el('a', '', T.veranstalter); a.href = m.link; a.rel = 'noopener nofollow'; a.target = '_blank'; a.setAttribute('aria-label', T.veranstalterLang + ': ' + m.name); wege.append(a); }
    var ka = el('a', '', T.karte); ka.href = 'https://www.openstreetmap.org/?mlat=' + m.lat + '&mlon=' + m.lon + '#map=16/' + m.lat + '/' + m.lon; ka.rel = 'noopener'; ka.target = '_blank'; ka.setAttribute('aria-label', T.karteLang + ': ' + m.name); wege.append(ka);
    fuss.append(wege);
    var quelle = m.quelle === 'osm' ? '© OpenStreetMap-Mitwirkende' : m.quelle === 'veranstalter' ? T.seiteVeranstalter : (m.vermerk || 'Stadt Essen, Datenlizenz Deutschland – Namensnennung – Version 2.0');
    var q = el('p', 'wm-quelle', T.quelle), vermerk = quelle.replace(/\s*\(https?:[^)]*\)/, '');
    if (sicher(m.lizenz)) { var li = el('a', '', vermerk); li.href = m.lizenz; li.rel = 'noopener license'; li.target = '_blank'; li.title = T.lizenz; q.append(li); } else q.append(vermerk);
    q.append(' · ', el('span', 'wm-nw', T.geprueft + datumLang(m.geprueft)));
    k.append(q);
    k.style.setProperty('--i', Math.min(i, JE_SEITE));
    return k;
  }

  function zeichneArten(nah) {
    var da = {};
    nah.forEach(function (t) { t.m.arten.forEach(function (a) { da[a] = 1; }); });
    zustand.arten = zustand.arten.filter(function (a) { return da[a]; });
    artenEl.querySelectorAll('.wm-wahl').forEach(function (b) { b.remove(); });
    Object.keys(T.arten).forEach(function (a) {
      if (!da[a]) return;
      var b = el('button', 'wm-wahl', T.arten[a]); b.type = 'button'; b.setAttribute('aria-pressed', String(zustand.arten.indexOf(a) > -1));
      b.addEventListener('click', function () {
        var i = zustand.arten.indexOf(a); if (i > -1) zustand.arten.splice(i, 1); else zustand.arten.push(a);
        zustand.gezeigt = JE_SEITE; zeichne(true);
      });
      chipsEl.append(b);
    });
    artenEl.hidden = !artenEl.querySelector('.wm-wahl');
  }

  function zeichneTage(bestaetigt) {
    tageEl.textContent = '';
    function knopf(wert, oben, unten, zahl, hat) {
      var b = el('button', 'wm-tag' + (hat ? ' wm-hat' : '') + (wert ? '' : ' wm-tag--alle')), k = el('span', 'wm-kugel'); b.type = 'button';
      b.setAttribute('aria-pressed', String(zustand.tag === wert)); k.append(el('span', 'wm-wt', oben), el('b', '', unten)); b.append(k, el('span', hat ? '' : 'wm-leer', zahl));
      if (wert) b.title = kurz(tag(wert)) + ': ' + zahl;
      b.addEventListener('click', function () { zustand.tag = wert; zustand.gezeigt = JE_SEITE; zeichne(true); });
      tageEl.append(b); return b;
    }
    knopf('', T.alle, T.tage, bestaetigt.length === 1 ? T.einMarkt : bestaetigt.length + T.maerkte, true);
    T.woche.forEach(function (w) { var k = el('span', 'wm-kalkopf', w); k.setAttribute('aria-hidden', 'true'); tageEl.append(k); });
    var d = heute(), ende = new Date(d.getFullYear(), d.getMonth(), d.getDate() + TAGE_VORAUS - 1);
    spanneEl.textContent = d.getDate() + '. ' + T.mon[d.getMonth()] + T.bis + ende.getDate() + '. ' + T.mon[ende.getMonth()];
    for (var i = 0; i < TAGE_VORAUS; i++) {
      var s = iso(d), n = bestaetigt.filter(function (t) { return offenAm(t.m, s); }).length;
      var b = knopf(s, T.wt[d.getDay()], d.getDate() + '.', n ? n + T.offen : T.zu, n > 0);
      if (!i) b.style.gridColumnStart = (d.getDay() + 6) % 7 + 1;   /* Kalender am Desktop: Woche beginnt am Montag */
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  }

  function zeichne(neu) {
    var nah = imUmkreis();
    zeichneArten(nah);
    var gefiltert = nah.filter(passtArt), bestaetigt = gefiltert.filter(function (t) { return t.m.status === 'bestaetigt'; });
    zeichneTage(bestaetigt);
    var treffer = zustand.tag ? bestaetigt.filter(function (t) { return offenAm(t.m, zustand.tag); }) : bestaetigt;
    zahlEl.textContent = !daten.maerkte.some(function (m) { return m.status === 'bestaetigt'; }) ? T.vorbei
      : zustand.tag ? (treffer.length ? T.zahlTag(kurz(tag(zustand.tag)), treffer.length) : T.keinTag(kurz(tag(zustand.tag)))) : (treffer.length ? T.zahlAlle(treffer.length, ortsname()) : T.keiner);
    unterEl.textContent = treffer.length ? T.unter(zustand.km) : ''; unterEl.hidden = !treffer.length;
    reihe.hidden = !nah.length;
    schirm.zeichne({ punkte: gefiltert.map(function (t) { return { m: t.m, km: t.km, liste: treffer.indexOf(t) }; }), weite: zustand.km, mitte: zustand.ort,
      ort: ortsname(), du: !!zustand.plz, tag: zustand.tag ? kurz(tag(zustand.tag)) : '', neu: neu, ruhig: ruhig });
    liste.textContent = '';
    treffer.slice(0, zustand.gezeigt).forEach(function (t, i) { liste.append(karte(t, i)); });
    if (treffer.length > zustand.gezeigt) {
      var mehr = el('button', 'wm-knopf wm-knopf--leise wm-mehr', T.mehr + ' (' + (treffer.length - zustand.gezeigt) + ')'), zeile = el('div', 'wm-mehr-zeile'); mehr.type = 'button';
      mehr.addEventListener('click', function () { zustand.gezeigt += JE_SEITE; zeichne(false); }); zeile.append(mehr); liste.append(zeile);
    }
    if (neu && !ruhig) { liste.classList.remove('wm-neu'); void liste.offsetWidth; liste.classList.add('wm-neu'); }
    var ohne = gefiltert.filter(function (t) { return t.m.status !== 'bestaetigt'; });
    offenEl.hidden = !ohne.length; offenEl.textContent = '';
    if (ohne.length) {
      var ul = el('ul'); offenEl.append(el('summary', '', T.ohneTermin(ohne.length)), ul);
      ohne.forEach(function (t) {
        var li = el('li'), name = sicher(t.m.link) ? el('a', '', t.m.name + ', ' + t.m.ort) : el('span', '', t.m.name + ', ' + t.m.ort);
        if (sicher(t.m.link)) { name.href = t.m.link; name.rel = 'noopener nofollow'; name.target = '_blank'; }
        li.append(name, el('span', '', entf(t.km))); ul.append(li);
      });
    }
    standEl.textContent = T.stand(daten.stand);
    arbeit.hidden = false; auftaktEl.hidden = true; rueck.hidden = false; seite.classList.add('wm-an');
    if (!zustand.plz) return;                      /* Suche rund um einen angetippten Markt: nichts in die Adresse */
    var q = new URLSearchParams(); q.set('plz', zustand.plz); if (zustand.km !== 25) q.set('km', zustand.km);
    /* hinter dem #: dieser Teil der Adresse geht nie an den Server, die Postleitzahl bleibt wirklich auf dem Gerät */
    try { history.replaceState(null, '', location.pathname + '#' + q); } catch (e) { /* Adresse bleibt, Suche läuft trotzdem */ }
  }

  function suche(springe) {
    var plz = eingabe.value.replace(/\D/g, '');
    fehler.hidden = true;
    if (plz.length !== 5) { fehler.textContent = T.plzFalsch; fehler.hidden = false; eingabe.focus(); return; }
    lade().then(function () {
      var ort = daten.plz[plz];
      if (!ort) { fehler.textContent = T.plzFremd; fehler.hidden = false; eingabe.focus(); return; }
      zustand.plz = plz; zustand.ort = ort; zustand.gezeigt = JE_SEITE; zeichne(true);
      if (springe) arbeit.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    }).catch(function () { fehler.textContent = T.laden; fehler.hidden = false; });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); suche(true); });

  /* ── Vor der Suche: was im Südosten gerade offen ist und bald losgeht; ein Tipp sucht rund um diesen Markt ── */
  function rundUm(m) {
    fehler.hidden = true;
    lade().then(function () {
      zustand.plz = ''; zustand.ort = [m.lat, m.lon, m.ort]; zustand.gezeigt = JE_SEITE; eingabe.value = ''; zeichne(true);
      arbeit.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    }).catch(function () { fehler.textContent = T.laden; fehler.hidden = false; form.scrollIntoView({ block: 'center' }); });
  }
  fetch(DATEN + 'auftakt.json').then(function (a) { return a.ok ? a.json() : []; }).then(function (liste) {
    var h = iso(heute());
    var wahl = liste.map(function (m) { var r = (m.termine || []).filter(function (x) { return x[1] >= h; })[0]; return r ? { m: m, r: r, offen: r[0] <= h } : null; })
      .filter(Boolean).sort(function (a, b) { return a.offen === b.offen ? (a.r[0] < b.r[0] ? -1 : a.r[0] > b.r[0] ? 1 : 0) : (a.offen ? 1 : -1); });
    /* erst, was als Nächstes öffnet, dann, was schon läuft: so steht oben, worauf man sich freuen kann */
    wahl = wahl.filter(function (w) { return !w.offen; }).slice(0, AUFTAKT_ZEILEN - 2).concat(wahl.filter(function (w) { return w.offen; }).slice(0, 2)).slice(0, AUFTAKT_ZEILEN);
    if (!wahl.length || zustand.ort) return;
    wahl.forEach(function (w) {
      var b = el('button', 'wm-auf'), wann = el('span', 'wm-auf-wann'); b.type = 'button';
      if (w.offen) { var jetzt = el('span', 'wm-heute'); jetzt.innerHTML = ZIMTSTERN; jetzt.append(T.laeuft); wann.append(el('i', '', T.bis.trim() + ' ' + kurz(tag(w.r[1]))), jetzt); }
      else wann.append(T.ab + kurz(tag(w.r[0])), el('i', '', T.bis.trim() + ' ' + kurz(tag(w.r[1]))));
      b.append(el('b', '', w.m.name), wann, el('span', '', w.m.ort));
      b.addEventListener('click', function () { rundUm(w.m); });
      aufListe.append(b);
    });
    auftaktEl.hidden = false;
  }).catch(function () { /* ohne die Liste bleibt die Seite, wie sie ist */ });
  /* Daten schon holen, sobald jemand ins Feld tippt: am Handy lagen sonst 3 bis 8 s zwischen „Suchen“ und Treffern (17.11.2026) */
  eingabe.addEventListener('focus', function () { lade().catch(function () { /* der Fehler kommt beim Suchen mit Meldung */ }); }, { once: true });
  document.querySelectorAll('#wm-umkreis .wm-wahl').forEach(function (b) {
    b.addEventListener('click', function () {
      zustand.km = +b.dataset.km;
      document.querySelectorAll('#wm-umkreis .wm-wahl').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (zustand.ort) { zustand.gezeigt = JE_SEITE; zeichne(true); }
    });
  });
  fetch(DATEN + 'stand.json').then(function (a) { return a.ok ? a.json() : null; }).then(function (s) { if (s) vertrauenEl.textContent = T.vertrauen(s); }).catch(function () { /* die Zeile bleibt leer, die Suche geht trotzdem */ });
  /* Rückkehr aus der Bestätigungsmail der Radar-Anmeldung: der Worker schickt auf #dabei, #anmeldung-abgelaufen oder #anmeldung-fehler */
  (function () {
    var art = location.hash.slice(1), text = T.bescheid[art], stand = $('.wm-bescheid-stand');
    if (!text || !stand) return;
    stand.textContent = text + (art === 'anmeldung-fehler' ? KONTAKT + '.' : ''); stand.classList.toggle('wm-warn', art !== 'dabei'); stand.hidden = false;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* Adresse bleibt */ }
    requestAnimationFrame(function () { $('.wm-bescheid').scrollIntoView({ block: 'start' }); });
  })();

  /* alte geteilte Adressen trugen ?plz=…: weiter lesen, nach der Suche steht sie hinter dem # */
  var start = new URLSearchParams(location.hash.length > 1 ? location.hash.slice(1) : location.search), startPlz = (start.get('plz') || '').replace(/\D/g, '');
  if (startPlz.length === 5) {
    eingabe.value = startPlz;
    var startKm = document.querySelector('#wm-umkreis .wm-wahl[data-km="' + (+start.get('km') || 25) + '"]'); if (startKm) startKm.click();
    suche(false);
  }

  /* ── Rückmeldung: erst nach der Suche sichtbar, Quittung erst nach Antwort des Servers ── */
  (function () {
    var schritt1 = $('.wm-r-frage'), ja = $('.wm-r-ja'), nein = $('.wm-r-nein'), fertig = $('.wm-r-fertig'), meldung = $('.wm-r-meldung'), sterne = 0;
    function zeig(x) { [schritt1, ja, nein, fertig].forEach(function (s) { s.hidden = s !== x; }); meldung.hidden = true; }
    $('#wm-r-ja').addEventListener('click', function () { zeig(ja); });
    $('#wm-r-nein').addEventListener('click', function () { zeig(nein); });
    var reihe = $('.wm-sterne');
    for (var i = 1; i <= 5; i++) (function (n) {
      var b = el('button', 'wm-stern'); b.type = 'button'; b.innerHTML = ZIMTSTERN; b.setAttribute('aria-label', T.sterneLabel(n)); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { sterne = n; reihe.querySelectorAll('.wm-stern').forEach(function (x, j) { x.setAttribute('aria-pressed', String(j < n)); }); });
      reihe.append(b);
    })(i);
    function sende(f, gefunden) {
      var text = f.querySelector('textarea').value.trim(), markt = f.querySelector('input[type="text"]');
      if (!gefunden && !text) { meldung.textContent = T.pflichtText; meldung.hidden = false; return; }
      var knopf = f.querySelector('.wm-knopf'); knopf.disabled = true;
      fetch(RUECKMELDUNG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        gefunden: gefunden, sterne: gefunden ? sterne : 0, text: text, markt: markt ? markt.value.trim() : '',
        grund: gefunden ? '' : (f.querySelector('input[name="wm-grund"]:checked') || {}).value || '',
        region: zustand.plz.slice(0, 2), umkreis: zustand.km, sprache: EN ? 'en' : 'de', _honey: f.querySelector('.wm-falle input').value }) })
        .then(function (a) { if (!a.ok) throw new Error(String(a.status)); return a.json(); })
        .then(function (a) { if (!a.ok) throw new Error('nein'); fertig.textContent = T.danke; zeig(fertig); })
        .catch(function () { meldung.textContent = T.sendeFehler + KONTAKT; meldung.hidden = false; knopf.disabled = false; });
    }
    /* „Markt melden“ am Ende der Seite: geht auch ohne Suche direkt zur Meldung */
    $('.wm-melden').addEventListener('click', function () {
      rueck.hidden = false; zeig(nein); rueck.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    });
    ja.addEventListener('submit', function (e) { e.preventDefault(); sende(ja, true); });
    nein.addEventListener('submit', function (e) { e.preventDefault(); sende(nein, false); });
  })();

  /* ── Szene: Schneefall in drei Tiefen, Blick folgt der Maus, Halte-Knopf ── */
  (function () {
    var szene = $('.wm-szene'), cv = $('canvas', szene), bild = $('img', szene), halt = $('.wm-halt'), ctx = cv.getContext('2d');
    var flocken = [], laeuft = !ruhig, sichtbar = false, raf = 0, b = 0, h = 0, zuletzt = 0, ANZAHL = 70;
    if (ruhig) { halt.hidden = true; return; }
    function mass() { var q = Math.min(window.devicePixelRatio || 1, 2); b = szene.clientWidth; h = szene.clientHeight; cv.width = b * q; cv.height = h * q; ctx.setTransform(q, 0, 0, q, 0, 0); }
    /* z = Tiefe: fern klein, langsam, blass; nah groß, schnell, weich */
    function neu(f, oben) { f.x = Math.random() * b; f.y = oben ? -8 : Math.random() * h; f.z = Math.random(); f.w = Math.random() * 6.3; return f; }
    function bildfolge(t) {
      var dt = Math.min((t - (zuletzt || t)) / 1000, .05); zuletzt = t; ctx.clearRect(0, 0, b, h);
      for (var i = 0; i < flocken.length; i++) {
        var f = flocken[i]; f.y += (16 + f.z * f.z * 54) * dt; f.w += dt * (.6 + f.z); f.x += Math.sin(f.w) * (6 + f.z * 12) * dt;
        if (f.y > h + 8) neu(f, true);
        var r = .7 + f.z * f.z * 3.1, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 1.6);
        g.addColorStop(0, 'rgba(240,246,255,' + (.28 + f.z * .5) + ')'); g.addColorStop(1, 'rgba(240,246,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.6, 0, 6.3); ctx.fill();
      }
      if (laeuft && sichtbar) raf = requestAnimationFrame(bildfolge);
    }
    function los() { cancelAnimationFrame(raf); zuletzt = 0; if (laeuft && sichtbar) raf = requestAnimationFrame(bildfolge); else if (!laeuft) ctx.clearRect(0, 0, b, h); }
    halt.addEventListener('click', function () { laeuft = !laeuft; halt.textContent = laeuft ? T.funkenAn : T.funkenAus; los(); });
    new IntersectionObserver(function (e) {
      sichtbar = e[0].isIntersecting;
      if (sichtbar) { mass(); if (!flocken.length) for (var i = 0; i < ANZAHL; i++) flocken.push(neu({}, false)); }
      los();
    }).observe(szene);
    window.addEventListener('resize', function () { if (sichtbar) mass(); });
    if (window.matchMedia('(pointer: fine)').matches) {
      szene.addEventListener('pointermove', function (e) {
        var k = szene.getBoundingClientRect(); bild.style.setProperty('--mx', ((e.clientX - k.left) / k.width - .5) * -22 + 'px'); bild.style.setProperty('--my', ((e.clientY - k.top) / k.height - .5) * -12 + 'px');
      });
      szene.addEventListener('pointerleave', function () { bild.style.setProperty('--mx', '0px'); bild.style.setProperty('--my', '0px'); });
    }
  })();
})();
