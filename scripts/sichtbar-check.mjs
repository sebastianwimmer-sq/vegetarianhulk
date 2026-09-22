#!/usr/bin/env node
/* sichtbar-check.mjs — bleibt am Seitenende etwas unsichtbar haengen?
 *
 * WARUM
 * Jede Fläche, die Inhalt zum Einblenden versteckt, kann ihn auch versteckt
 * LASSEN. Das ist ein stiller Ausfall: keine Fehlermeldung, keine Konsole,
 * kein Statuscode — nur ein Besucher, der einen Abschnitt nie zu sehen
 * bekommt. Am 22.09.2026 blieben beim schnellen Durchscrollen Abschnitte
 * ohne `.in` zurueck, einer davon 4.130 px oberhalb der Fensterkante.
 *
 * Genau deshalb wurde beim Umbau auf scroll-gebundene Einblendungen die
 * pauschale Umstellung wieder zurueckgenommen: mit `animation-timeline` blieben
 * auf drei Seiten ganze Abschnitte bei Deckkraft 0, weil der `entry`-Bereich
 * fuer das unterste Element nicht zu Ende zu scrollen ist. Dieses Tor haelt
 * diese Erkenntnis fest, damit sie nicht in einer spaeteren Runde zurueckkommt.
 *
 * DETERMINISTISCH WARTEN, NICHT ZEITFENSTER RATEN. Ein erster Messlauf mit
 * 1,6 s meldete zwei Abschnitte der Live-Startseite als unsichtbar — sie waren
 * nur mitten im Uebergang. Falsch rot ist genauso kaputt wie falsch gruen.
 * Deshalb wird gewartet, bis sich nichts mehr bewegt (getAnimations + zwei
 * ruhige Messungen in Folge), und erst dann gemessen.
 *
 * Aufruf:  node scripts/sichtbar-check.mjs [--live] [--selbsttest]
 */

import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const WURZEL = resolve(import.meta.dirname, '..');
const LIVE = process.argv.includes('--live');
const SELBSTTEST = process.argv.includes('--selbsttest');
const PORT = 8248;
const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
const LATTE = 0.95;   // darunter gilt ein Element als nicht lesbar

if (SELBSTTEST) {
  /* Fixture im Speicher: eine Seite, auf der ein Block haengen bleibt, muss
     rot werden — eine saubere gruen. Ohne beide Faelle weiss niemand, ob das
     Tor ueberhaupt anschlaegt. */
  let chromium;
  try { ({ chromium } = await import(PW)); }
  catch { console.error(`Playwright nicht gefunden unter ${PW}`); process.exit(2); }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });

  const bauen = (haengt) => `<style>
    body{margin:0} section{height:800px;background:#123}
    .rv{opacity:0;transition:opacity 120ms}
    ${haengt ? '' : '.rv.in{opacity:1}'}
  </style>
  <section></section><section class="rv in">Text</section>`;

  const messen = async (html) => {
    await p.setContent(html);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(400);
    return p.evaluate((l) => [...document.querySelectorAll('.rv')]
      .filter((e) => e.offsetParent !== null && +getComputedStyle(e).opacity < l).length, LATTE);
  };

  const kaputt = await messen(bauen(true));
  const sauber = await messen(bauen(false));
  await b.close();

  if (kaputt !== 1) { console.error(`✗ SELBSTTEST: haengender Block nicht erkannt (${kaputt}).`); process.exit(1); }
  if (sauber !== 0) { console.error(`✗ SELBSTTEST: sauberer Block faelschlich gemeldet (${sauber}).`); process.exit(1); }
  console.log('✓ Selbsttest: haengender Block wird rot, sauberer bleibt gruen.');
  process.exit(0);
}

let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW}`); process.exit(2); }

const BASIS = LIVE ? 'https://vegetarianhulk.de' : `http://localhost:${PORT}`;
let server = null;
if (!LIVE) {
  server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
}

const seiten = [];
for (const d of readdirSync(WURZEL)) if (d.endsWith('.html')) seiten.push('/' + d);
for (const d of readdirSync(WURZEL, { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(join(WURZEL, d.name, 'index.html')) && !d.name.startsWith('.'))
    seiten.push(`/${d.name}/`);
}
for (const d of readdirSync(join(WURZEL, 'touren'), { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(join(WURZEL, 'touren', d.name, 'index.html')))
    seiten.push(`/touren/${d.name}/`);
}

const browser = await chromium.launch();
const befunde = [];
let geprueft = 0;

for (const pfad of seiten) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(BASIS + pfad, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    /* Warten, bis Ruhe ist: zwei gleiche Messungen in Folge und keine
       laufende Animation mehr. Kein geratenes Zeitfenster. */
    await page.waitForFunction(() => {
      const zahl = [...document.querySelectorAll('.rv,.st,.zug')]
        .filter((e) => e.offsetParent !== null && +getComputedStyle(e).opacity < 0.95).length;
      const laeuft = document.getAnimations().some((a) => a.playState === 'running');
      window.__letzte = window.__letzte === undefined ? -1 : window.__vor;
      window.__vor = zahl;
      return !laeuft && window.__letzte === zahl;
    }, null, { timeout: 15000 }).catch(() => { /* Ruhe kam nicht — wird unten gemessen */ });

    const offen = await page.evaluate((l) => [...document.querySelectorAll('.rv,.st,.zug')]
      .filter((e) => e.offsetParent !== null && +getComputedStyle(e).opacity < l)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')} `
        + `(${(+getComputedStyle(e).opacity).toFixed(2)})`), LATTE);

    geprueft++;
    if (offen.length) befunde.push(`${pfad}: ${offen.length} unsichtbar — ${offen.slice(0, 4).join(', ')}`);
  } catch (e) {
    befunde.push(`${pfad}: nicht ladbar (${e.message.split('\n')[0]})`);
  }
  await page.close();
}

await browser.close();
if (server) server.kill();

if (befunde.length) {
  console.error(`✗ sichtbar-check: ${befunde.length} Seite(n) mit haengendem Inhalt:`);
  befunde.forEach((b) => console.error(`    ${b}`));
  console.error('\n  Inhalt, der nie sichtbar wird, ist schlimmer als eine ruhige Seite.');
  console.error('  Scroll-gebundene Einblendungen NIE pauschal auf `.rv` — der `entry`-Bereich');
  console.error('  ist fuer das unterste Element einer Seite nicht zu Ende zu scrollen.');
  process.exit(1);
}
console.log(`✓ sichtbar-check: ${geprueft} Seiten durchgescrollt, nichts bleibt unsichtbar.`);
