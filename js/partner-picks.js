/* Ausgelagert aus partner-picks/index.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt. */
/* Partner als v3-Karten (aus VH_PARTNERS) — Copy-Code + CTA /go/<slug>/ */
(function () {
  'use strict';
  var mount = document.getElementById('partner-index');
  if (!mount || typeof VH_PARTNERS === 'undefined') return;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function n2(i) { return (i < 10 ? '0' : '') + i; }
  function arrow() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.4'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M7 17 17 7M9 7h8v8'); s.appendChild(p); return s;
  }

  VH_PARTNERS.filter(function (p) { return p.active; })
    .sort(function (a, b) { return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || (a.sortOrder || 0) - (b.sortOrder || 0); })
    .forEach(function (p, i) {
      var card = el('article', 'pp-card rv');
      card.style.setProperty('--d', (i * 90) + 'ms');
      card.appendChild(el('span', 'pp-card__no', n2(i + 1)));

      var head = el('div', 'pp-card__head');
      if (p.category) head.appendChild(el('span', 'pp-card__cat', p.category));
      if (p.discount) head.appendChild(el('span', 'pp-badge', '–' + p.discount));
      card.appendChild(head);

      card.appendChild(el('h3', 'pp-card__name', p.name));
      card.appendChild(el('p', 'pp-card__text', p.valueLine));

      if (p.hint) { var h = el('p', 'pp-hint'); h.appendChild(el('strong', null, p.hint.lead + ' ')); h.appendChild(document.createTextNode(p.hint.text)); card.appendChild(h); }

      if (p.code) {
        var code = el('div', 'pp-code');
        code.appendChild(el('code', null, p.code));
        var btn = el('button', 'pp-copy', 'Copy'); btn.type = 'button';
        btn.addEventListener('click', function () {
          if (navigator.clipboard) navigator.clipboard.writeText(p.code);
          btn.textContent = 'Kopiert'; btn.classList.add('copied');
          setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
        });
        code.appendChild(btn); card.appendChild(code);
      }

      card.appendChild(el('p', 'pp-fine', 'Affiliate-Link: Wenn du über Code/Link kaufst, erhalte ich eine Provision. Für dich entstehen keine Mehrkosten.' + (p.finePrintExtra ? ' ' + p.finePrintExtra : '')));

      var cta = el('a', 'th-btn th-btn--gelb pp-cta', 'Zum Shop'); cta.href = '/go/' + p.slug + '/'; cta.rel = 'sponsored noopener'; cta.appendChild(arrow());
      card.appendChild(cta);

      mount.appendChild(card);
    });
})();

/* ---- naechster Block ---- */

/* Produkte als v3-Karten (aus VH_PRODUCTS) — Amazon-CTA */
(function () {
  'use strict';
  var mount = document.getElementById('product-index');
  if (!mount || typeof VH_PRODUCTS === 'undefined') return;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function n2(i) { return (i < 10 ? '0' : '') + i; }
  function isPending(url) { return !url || url.indexOf('PENDING_') === 0; }
  function arrow() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.4'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M7 17 17 7M9 7h8v8'); s.appendChild(p); return s;
  }

  var aktive = VH_PRODUCTS.filter(function (p) { return p.active; });
  if (!aktive.length) return;

  /* ---- Stück der Woche --------------------------------------------------
     Deterministisch aus der Kalenderwoche, nicht zufällig: in derselben Woche
     sieht jeder dasselbe Stück, und es wechselt von allein weiter. Mit
     Math.random() stünde bei jedem Neuladen ein anderes oben — das liest sich
     wie ein Fehler, nicht wie eine Empfehlung. Ohne Deploy, ohne Pflege. */
  function kalenderwoche(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   /* ISO 8601: Donnerstag entscheidet */
    var jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { kw: Math.ceil(((t - jan1) / 86400000 + 1) / 7), jahr: t.getUTCFullYear() };
  }
  var w = kalenderwoche(new Date());
  /* Jahr mitzählen, sonst zeigt KW 12 in zwei Jahren dasselbe Stück. */
  var dieseWoche = aktive[(w.jahr * 53 + w.kw) % aktive.length];

  var hl = document.getElementById('pp-woche');
  if (hl) {
    hl.hidden = false;
    hl.querySelector('[data-w-kw]').textContent = 'KW ' + w.kw;
    hl.querySelector('[data-w-kat]').textContent = dieseWoche.kategorie || '';
    hl.querySelector('[data-w-name]').textContent = dieseWoche.name;
    hl.querySelector('[data-w-text]').textContent = dieseWoche.text || '';
    var hlCta = hl.querySelector('[data-w-cta]');
    if (isPending(dieseWoche.url)) {
      hlCta.replaceWith(el('span', 'pp-pending', 'Link folgt in Kürze'));
    } else {
      hlCta.href = '/go/amazon/?to=' + encodeURIComponent(dieseWoche.url)
        + '&name=' + encodeURIComponent(dieseWoche.name);
      hlCta.appendChild(arrow());
    }
  }

  /* ---- Filter aus den Daten, nicht aus dem Markup ------------------------
     Die Kategorien stehen in products.js. Die Chips daraus zu bauen heißt:
     eine neue Kategorie erscheint von selbst, und es gibt keinen zweiten Ort,
     der mitgepflegt werden müsste und driften kann. */
  var kategorien = [];
  aktive.forEach(function (p) {
    var k = p.kategorie || 'Sonstiges';
    if (kategorien.indexOf(k) === -1) kategorien.push(k);
  });

  var karten = aktive.map(function (p, i) { return { daten: p, el: karte(p, i) }; });

  var leiste = document.getElementById('pp-filter');
  var zaehler = document.getElementById('pp-zahl');
  if (leiste && kategorien.length > 1) {
    leiste.hidden = false;
    var chips = [];
    var setzen = function (wert) {
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.dataset.v === wert ? 'true' : 'false');
      });
      var sichtbar = 0;
      karten.forEach(function (k) {
        var passt = !wert || (k.daten.kategorie || 'Sonstiges') === wert;
        k.el.hidden = !passt;
        /* Die Nummer zählt das SICHTBARE durch — sonst steht nach einem Filter
           „04, 07, 11" da und sieht aus, als fehlte etwas. */
        if (passt) { sichtbar++; k.el.querySelector('.pp-card__no').textContent = n2(sichtbar); }
      });
      if (zaehler) zaehler.textContent = sichtbar;
    };
    /* Fehlt eine Kurzform, steht der ganze Satz auf der Pille — unschön, aber
       vollständig. Das Tor in produkte-sync.mjs meldet die Lücke. */
    var kurz = (typeof VH_KATEGORIE_KURZ !== 'undefined') ? VH_KATEGORIE_KURZ : {};
    [['', 'Alles']].concat(kategorien.map(function (k) { return [k, kurz[k] || k]; }))
      .forEach(function (paar) {
        var c = el('button', 'tk-chip', paar[1]);
        c.type = 'button';
        c.dataset.v = paar[0];
        c.setAttribute('aria-pressed', paar[0] === '' ? 'true' : 'false');
        c.addEventListener('click', function () { setzen(paar[0]); });
        chips.push(c);
        leiste.appendChild(c);
      });
    setzen('');
  }

  function karte(p, i) {
    var card = el('article', 'pp-card rv');
    card.style.setProperty('--d', (i * 90) + 'ms');
    card.appendChild(el('span', 'pp-card__no', n2(i + 1)));

    var head = el('div', 'pp-card__head');
    if (p.kategorie) head.appendChild(el('span', 'pp-card__cat', p.kategorie));
    card.appendChild(head);

    card.appendChild(el('h3', 'pp-card__name', p.name));
    card.appendChild(el('p', 'pp-card__text', p.text));

    if (p.preisHinweis) card.appendChild(el('p', 'pp-price', p.preisHinweis));

    if (!isPending(p.url)) card.appendChild(el('p', 'pp-fine', 'Amazon-Partnerlink: Wenn du darüber kaufst, erhalte ich eine Provision. Für dich entstehen keine Mehrkosten.'));

    if (isPending(p.url)) {
      card.appendChild(el('span', 'pp-pending', 'Link folgt in Kürze'));
    } else {
      var cta = el('a', 'th-btn th-btn--gelb pp-cta', 'Auf Amazon ansehen');
      cta.href = '/go/amazon/?to=' + encodeURIComponent(p.url) + '&name=' + encodeURIComponent(p.name);
      cta.target = '_blank'; cta.rel = 'sponsored noopener'; cta.appendChild(arrow());
      card.appendChild(cta);
    }

    mount.appendChild(card);
    return card;
  }
})();
