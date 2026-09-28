#!/usr/bin/env node
/* hoehenmeter-check.mjs — zeigt die Hoehenmeter-Leiste am Rand, wo man steht?
 *
 * WARUM
 * Sebi am 28.09.2026: "die hoehenmeter anzeige am rand haengt bzw.
 * funktioniert bei einigen seiten nicht mehr richtig". Gemessen:
 *   · auf fuenf Seiten stand die ZAHL fest (2713 bzw. 1765 hm) — beim Kopieren
 *     des Rail-Markups war `data-hm` verloren gegangen;
 *   · die MARKE lief per `top` mit 300 ms Uebergang hinterher, beim Scrollen
 *     bis 400 px daneben, auf der Startseite kam sie nie an.
 * Kein Tor hat es gesehen: Standbilder zeigen eine vorhandene, gut lesbare
 * Leiste. Gemessen wird deshalb ueber die ZEIT, waehrend und nach dem Scrollen.
 *
 * Aufruf:  node scripts/hoehenmeter-check.mjs [--selbsttest]
 *   --selbsttest spielt v3.css/v3.js aus VORHER ein — das Tor MUSS rot werden.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const { chromium } = await import('/opt/homebrew/lib/node_modules/playwright/index.mjs');
const WURZEL = resolve(import.meta.dirname, '..');
const SELBSTTEST = process.argv.includes('--selbsttest');
const VORHER = '69f8f90';
const LATTE_LAUFEND = 30, LATTE_RUHE = 2;
const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.webp': 'image/webp' };

const server = await new Promise((fertig) => {
  const s = createServer(async (anf, ant) => {
    let pfad = join(WURZEL, decodeURIComponent(anf.url.split('?')[0]));
    if (pfad.endsWith('/')) pfad += 'index.html';
    try {
      let inhalt = await readFile(pfad);
      if (SELBSTTEST && (pfad.endsWith('/v3.css') || pfad.endsWith('/v3.js')))
        inhalt = execFileSync('git', ['show', `${VORHER}:${pfad.endsWith('.css') ? 'v3.css' : 'v3.js'}`], { cwd: WURZEL });
      ant.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
      ant.end(inhalt);
    } catch { ant.writeHead(404); ant.end('weg'); }
  });
  s.listen(0, () => fertig(s));
});
const BASIS = `http://localhost:${server.address().port}`;

const SEITEN = ['/', '/kooperationen.html', '/anfrage.html', '/newsletter/', '/partner-picks/', '/touren/',
  '/touren/hoerndlwand/', '/touren/fellhorn/', '/impressum.html'];

const browser = await chromium.launch();
const seite = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const zustand = () => seite.evaluate(() => {
  const rail = document.querySelector('.rail--l'); const peak = rail && rail.querySelector('.rail-peak');
  if (!peak) return null;
  const max = document.documentElement.scrollHeight - innerHeight;
  const soll = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  const rr = rail.getBoundingClientRect();
  return { abw: Math.round(peak.getBoundingClientRect().top - (rr.top + rr.height * (0.10 + 0.78 * soll))),
    hm: peak.querySelector('.hm').textContent, hmSoll: (2713 - Math.round(soll * 2713)) + ' hm' };
});

const befunde = [];
for (const s of SEITEN) {
  await seite.goto(BASIS + s, { waitUntil: 'load' }); await seite.waitForTimeout(700);
  if (!(await zustand())) { befunde.push(`${s}: keine Hoehenmeter-Leiste`); continue; }
  let laufend = 0, ruhe = 0, zahl = 0;
  await seite.mouse.move(720, 450);
  for (let i = 0; i < 10; i++) {
    await seite.mouse.wheel(0, 700); await seite.waitForTimeout(90);
    laufend = Math.max(laufend, Math.abs((await zustand()).abw));
    await seite.waitForTimeout(600);
    const z = await zustand();
    ruhe = Math.max(ruhe, Math.abs(z.abw));
    if (z.hm !== z.hmSoll) zahl++;
  }
  console.log(`  ${s.padEnd(24)} Marke laufend ${String(laufend).padStart(3)} px · in Ruhe ${String(ruhe).padStart(3)} px · Zahl falsch ${zahl}/10`);
  if (laufend > LATTE_LAUFEND) befunde.push(`${s}: Marke hinkt beim Scrollen ${laufend} px hinterher`);
  if (ruhe > LATTE_RUHE) befunde.push(`${s}: Marke steht in Ruhe ${ruhe} px daneben`);
  if (zahl) befunde.push(`${s}: Hoehenmeter-Zahl ${zahl}/10 falsch`);
}
await browser.close(); server.close();

if (SELBSTTEST) {
  if (befunde.length) { console.log(`\n✓ Selbsttest: Stand ${VORHER} wird erkannt (${befunde.length} Befunde).`); process.exit(0); }
  console.error(`\n✗ SELBSTTEST: Stand ${VORHER} blieb gruen.`); process.exit(1);
}
if (befunde.length) { console.error(`\n✗ hoehenmeter-check: ${befunde.length} Befund(e):`); befunde.forEach((b) => console.error('    ' + b)); process.exit(1); }
console.log('\n✓ hoehenmeter-check: Marke und Zahl folgen dem Scrollstand auf allen Seiten.');
