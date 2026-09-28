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
 * NACHTRAG 28.09.2026 — das Tor hat die eigentliche Ursache nie gesehen.
 * Es war fuer eine Leiste gebaut, die zwischen Kopf und Fuss FAEHRT, und hat
 * diese Fahrt deshalb geduldet. Gemessen: 785 px quer ueber den Schirm bei
 * jedem Verlassen des Kopfs und jedem Seitenwechsel, in WebKit 528 px Sprung
 * beim Laden — alles gruen. Seitdem steht die Leiste fest, und das Tor prueft
 * genau das: vom ersten Bild nach dem Laden bis nach dem Scrollen bewegt sie
 * sich hoechstens um RUHE_PX. Selbsttest: der Stand vor dem Umbau (Commit
 * VORHER) wird aus git eingespielt und MUSS rot werden.
 *
 * Aufruf:  node scripts/nav-check.mjs [--selbsttest]
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let engines;
try { engines = await import(PW); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const WURZEL = resolve(import.meta.dirname, '..');
const SELBSTTEST = process.argv.includes('--selbsttest');

/* Kleines Wackeln (der Fall aus Safari) und grosser Schwung, der den Kopf
   wirklich verlaesst. In beiden darf sich die Leiste nicht bewegen. */
const WACKELN = 260;
const GROSS = 900;
/* Subpixel-Rundung und ein Rest Einrasten beim Laden — mehr nicht. */
const RUHE_PX = 2;
/* Letzter Stand mit der fahrenden Leiste — Fixture fuer den Selbsttest. */
const VORHER = 'fec151b';

const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.webp': 'image/webp' };

function alterStand(datei) {
  return execFileSync('git', ['show', `${VORHER}:${datei}`], { cwd: WURZEL });
}

function server() {
  return new Promise((fertig) => {
    const s = createServer(async (anfrage, antwort) => {
      let pfad = join(WURZEL, decodeURIComponent(anfrage.url.split('?')[0]));
      if (pfad.endsWith('/')) pfad += 'index.html';
      try {
        let inhalt = await readFile(pfad);
        if (SELBSTTEST && (pfad.endsWith('/v3.css') || pfad.endsWith('/v3.js')))
          inhalt = alterStand(pfad.endsWith('.css') ? 'v3.css' : 'v3.js');
        antwort.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
        antwort.end(inhalt);
      } catch { antwort.writeHead(404); antwort.end('weg'); }
    });
    s.listen(0, () => fertig({ s, port: s.address().port }));
  });
}

/* Protokolliert die Oberkante der Leiste in JEDEM Bild ab dem ersten — sonst
   saehe man den Sprung beim Laden nicht, der vor jedem spaeten Messbeginn liegt. */
const PROBE = `(() => { window.__log = []; const tick = () => {
  const n = document.querySelector('.nav');
  if (n) { const s = getComputedStyle(n);
    window.__log.push({ pos: Math.round(n.getBoundingClientRect().top), op: +(+s.opacity).toFixed(2) }); }
  requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`;

async function messen(engine, port, breite, hoehe) {
  const browser = await engine.launch();
  const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } });
  await kontext.addInitScript(PROBE);
  const seite = await kontext.newPage();
  await seite.goto(`http://localhost:${port}/touren/fellhorn/`, { waitUntil: 'load' });
  await seite.waitForTimeout(1200);
  await seite.mouse.move(breite / 2, hoehe / 2);
  for (const weite of [WACKELN, GROSS]) {
    for (let i = 0; i < 8; i++) {
      await seite.mouse.wheel(0, weite); await seite.waitForTimeout(60);
      await seite.mouse.wheel(0, -weite); await seite.waitForTimeout(60);
    }
  }
  await seite.mouse.wheel(0, 2400);
  await seite.waitForTimeout(1500);
  const l = await seite.evaluate(() => window.__log);
  await browser.close();
  /* Die ersten Bilder vor dem ersten Layout zaehlen nicht (Leiste noch 0 hoch). */
  const sichtbar = l.filter((x) => x.op > 0.05);
  const pos = sichtbar.map((x) => x.pos);
  let weg = 0;
  for (let i = 1; i < pos.length; i++) weg = Math.max(weg, Math.abs(pos[i] - pos[0]));
  const blinker = l.filter((x, i) => i && l[i - 1].op > 0.05 && x.op <= 0.05).length;
  return { weg, blinker, proben: l.length, ende: l.at(-1) };
}

const { s, port } = await server();
const befunde = [];
for (const [name, engine] of [['WebKit', engines.webkit], ['Chromium', engines.chromium],
                              ['Firefox', engines.firefox]]) {
  for (const [b, h] of [[1440, 900], [390, 844]]) {
    const r = await messen(engine, port, b, h);
    console.log(`  ${name.padEnd(9)}${String(b).padStart(5)} px   bewegt ${String(r.weg).padStart(4)} px`
      + ` · Blinker ${r.blinker} · Proben ${r.proben}` + (r.ende.op > 0.9 ? '' : '  *** UNSICHTBAR ***'));
    if (r.weg > RUHE_PX) befunde.push(`${name}/${b}: die Leiste bewegt sich um ${r.weg} px`);
    if (r.blinker) befunde.push(`${name}/${b}: ${r.blinker}× verschwindet die Leiste`);
    if (!(r.ende.op > 0.9)) befunde.push(`${name}/${b}: am Ende nicht sichtbar`);
  }
}
s.close();

if (SELBSTTEST) {
  if (befunde.length) {
    console.log(`\n✓ Selbsttest: der Stand ${VORHER} (fahrende Leiste) wird erkannt (${befunde.length} Befunde).`);
    process.exit(0);
  }
  console.error(`\n✗ SELBSTTEST: der Stand ${VORHER} wurde NICHT erkannt — das Tor sieht seinen Fehlerfall nicht.`);
  process.exit(1);
}
if (befunde.length) {
  console.error(`\n✗ nav-check: ${befunde.length} Befund(e):`);
  befunde.forEach((b) => console.error(`    ${b}`));
  process.exit(1);
}
console.log('\n✓ nav-check: die Leiste steht fest — beim Laden, beim Wackeln und beim grossen Schwung.');
