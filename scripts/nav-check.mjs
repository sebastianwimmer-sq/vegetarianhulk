#!/usr/bin/env node
/* nav-check.mjs — prueft, dass die Nav beim Scrollen nicht flackert.
 *
 * WARUM DIESES TOR
 * Sebi meldete am 16.09.2026: "im Safari verschwindet die Nav-Bar, wenn ich
 * schnell hin und her scrolle". Kein bestehendes Tor konnte das sehen — die
 * Leiste ist auf jeder Seite, in jeder Engine, auf jeder Breite korrekt
 * vorhanden und vollstaendig sichtbar. Der Fehler zeigt sich ausschliesslich
 * in BEWEGUNG.
 *
 * Ursache war eine einzige Schwelle bei 120 px: wer darum herumscrollt, loeste
 * jedes Mal die 210-ms-Ausblende aus, und waehrend der Nachlaufsperre stand die
 * Leiste sichtbar im falschen Zustand (gemessen: 4 Blinker und 31 von 137
 * Proben falsch, in drei Sekunden Wackeln).
 *
 * Gemessen wird deshalb ueber die ZEIT, nicht an einem Standbild:
 *   · Blinker   — die Leiste wird unsichtbar und kommt zurueck
 *   · Falsch    — sie ist voll sichtbar, zeigt aber den Zustand der anderen
 *                 Scrollposition
 *   · Haengt    — nach der Ruhephase nicht voll sichtbar (der schlimmste Fall)
 *
 * Aufruf:  node scripts/nav-check.mjs [--selbsttest]
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let engines;
try { engines = await import(PW); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const WURZEL = resolve(import.meta.dirname, '..');
const SELBSTTEST = process.argv.includes('--selbsttest');

/* Das kleine Wackeln um die Schwelle ist der Fall, den Sebi trifft — dort darf
   NICHTS passieren. Der grosse Schwung verlaesst den Seitenkopf wirklich; dort
   ist ein Formwechsel richtig, er darf nur nicht haengenbleiben. */
const WACKELN = 260;
const GROSS = 900;

const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

/* Rueckbau auf den Zustand vor dem 17.09.2026: oben per `top` verankert statt
   nach oben geschoben. Zwischen `top` und `bottom` kann kein Browser animieren
   — die Leiste springt dann. Nur im Speicher, die Datei bleibt unberuehrt. */
function zurueckbauen(css) {
  const alt = css.replace(/translate: -50% var\(--nav-oben, -740px\);/,
                          'top: 0; bottom: auto; translate: -50% 22px;');
  if (alt === css) throw new Error('Rueckbau greift nicht — Muster in v3.css geaendert?');
  return alt;
}

function server() {
  return new Promise((fertig) => {
    const s = createServer(async (anfrage, antwort) => {
      let pfad = join(WURZEL, decodeURIComponent(anfrage.url.split('?')[0]));
      if (pfad.endsWith('/')) pfad += 'index.html';
      try {
        let inhalt = await readFile(pfad);
        if (SELBSTTEST && pfad.endsWith('v3.css')) inhalt = zurueckbauen(inhalt.toString());
        antwort.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
        antwort.end(inhalt);
      } catch { antwort.writeHead(404); antwort.end('weg'); }
    });
    s.listen(0, () => fertig({ s, port: s.address().port }));
  });
}

async function messen(engine, port, weite) {
  const browser = await engine.launch();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const seite = await kontext.newPage();
  await seite.goto(`http://localhost:${port}/touren/fellhorn/`, { waitUntil: 'domcontentloaded' });
  await seite.waitForTimeout(1100);

  await seite.evaluate(() => {
    window.__log = [];
    const nav = document.querySelector('.nav');
    window.__stop = setInterval(() => {
      const s = getComputedStyle(nav);
      window.__log.push({ y: Math.round(window.scrollY), pos: Math.round(nav.getBoundingClientRect().top),
        op: +(+s.opacity).toFixed(2), top: nav.classList.contains('at-top') });
    }, 30);
  });

  await seite.mouse.move(700, 450);
  for (let i = 0; i < 12; i++) {
    await seite.mouse.wheel(0, weite); await seite.waitForTimeout(60);
    await seite.mouse.wheel(0, -weite); await seite.waitForTimeout(60);
  }
  await seite.waitForTimeout(2200);   // Ruhe: jetzt MUSS sie stehen

  const ergebnis = await seite.evaluate(() => {
    clearInterval(window.__stop);
    const l = window.__log;
    let blinker = 0, war = true, falsch = 0, sprung = 0;
    const unten = Math.round(window.innerHeight - 18
      - document.querySelector('.nav').getBoundingClientRect().height);
    const ruhe = (q) => Math.abs(q - 22) < 25 || Math.abs(q - unten) < 25;

    for (let i = 0; i < l.length; i++) {
      const x = l[i];
      const sichtbar = x.op > 0.05;
      if (war && !sichtbar) blinker++;
      war = sichtbar;

      /* SPRUNG = von RUHELAGE zu RUHELAGE in einer einzigen Probe. Genau das
         tat die Leiste bis zum 17.09.2026: oben per `top`, unten per `bottom`
         verankert — dazwischen kann kein Browser animieren. Landet ein grosser
         Ortswechsel dagegen MITTEN auf der Strecke, war es eine ausgelassene
         Messprobe waehrend schneller Fahrt (WebKit und Firefox tun das bei
         Richtungswechseln) und kein Defekt. */
      if (i && x.op > 0.5 && l[i-1].op > 0.5
          && Math.abs(x.pos - l[i-1].pos) > (unten - 22) * 0.6
          && ruhe(l[i-1].pos) && ruhe(x.pos)) sprung++;

      /* FALSCH nur im RUHENDEN Zustand: waehrend der Fahrt steht die Klasse
         schon auf dem Ziel, die Leiste aber noch unterwegs — das ist richtig. */
      const soll = x.y <= 60 ? true : (x.y >= 340 ? false : null);
      if (ruhe(x.pos) && soll !== null && x.op > 0.9 && soll !== x.top) falsch++;
    }
    const e = l[l.length - 1];
    return { blinker, falsch, sprung, proben: l.length, haengt: !(e.op > 0.9), ende: e };
  });
  await browser.close();
  return ergebnis;
}

const { s, port } = await server();
const befunde = [];
const zeilen = [];

for (const [name, engine] of [['WebKit', engines.webkit], ['Chromium', engines.chromium],
                              ['Firefox', engines.firefox]]) {
  for (const [weite, art] of [[WACKELN, 'Wackeln'], [GROSS, 'grosser Schwung']]) {
    const r = await messen(engine, port, weite);
    zeilen.push(`  ${name.padEnd(9)}${art.padEnd(17)}Blinker ${String(r.blinker).padStart(2)}`
      + ` · Sprünge ${String(r.sprung).padStart(2)}`
      + ` · falsch ${String(r.falsch).padStart(2)}/${r.proben}`
      + (r.haengt ? '  *** HAENGT UNSICHTBAR ***' : ''));

    if (r.haengt) befunde.push(`${name}/${art}: Nav bleibt nach der Ruhephase unsichtbar`);
    if (r.blinker > 0)
      befunde.push(`${name}/${art}: ${r.blinker}× verschwindet die Leiste und kommt zurück`);

    if (weite === WACKELN) {
      /* Der Fall, den Sebi trifft: hier steht die Leiste still, Latte = null. */
      if (r.sprung > 0) befunde.push(`${name}/Wackeln: ${r.sprung}× springt die Leiste über den Schirm`);
      if (r.falsch > 0) befunde.push(`${name}/Wackeln: ${r.falsch} Proben zeigen den falschen Zustand`);
    } else if (r.sprung > 2) {
      /* Beim grossen Schwung wird zwoelfmal in drei Sekunden ueber den ganzen
         Schirm gerissen. Ein einzelnes hinterherhinkendes Bild ist dort
         Messrauschen — das hat den Lauf abwechselnd rot und gruen gemacht.
         Eine echte Regression erzeugt zwei Dutzend Spruenge, keine zwei. */
      befunde.push(`${name}/grosser Schwung: ${r.sprung}× springt die Leiste über den Schirm`);
    }
  }
}
s.close();

zeilen.forEach((z) => console.log(z));

if (SELBSTTEST) {
  if (befunde.length) {
    console.log(`\n✓ Selbsttest: mit der alten Verankerung schlägt das Tor an (${befunde.length} Befunde).`);
    process.exit(0);
  }
  console.error('\n✗ SELBSTTEST: der Rückbau auf die alte Verankerung wurde NICHT erkannt — '
    + 'das Tor kann seinen eigenen Fehlerfall nicht sehen.');
  process.exit(1);
}

if (befunde.length) {
  console.error(`\n✗ nav-check: ${befunde.length} Befund(e):`);
  befunde.forEach((b) => console.error(`    ${b}`));
  console.error('\n  Schwellen: v3.js (OBEN_BIS / UNTEN_AB) · Verankerung: v3.css (.nav.at-top).');
  process.exit(1);
}
console.log('\n✓ nav-check: kein Flackern, kein falscher Zustand, nichts hängt.');
