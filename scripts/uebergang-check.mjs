#!/usr/bin/env node
/* uebergang-check.mjs — laeuft der Seitenwechsel so, wie uebergang.js ihn plant?
 *
 * WARUM
 * Ein View-Transition-Fehler meldet sich nirgends: fehlt der Name auf einer
 * Seite, steht er doppelt oder kommt das Skript zu spaet, laedt die Seite
 * einfach ohne Uebergang. Bis zum 28.09.2026 hatte nur eine von fuenf Touren
 * den Foto-Uebergang — kein Tor hat es gesehen, weil jedes Tor Standbilder misst.
 *
 * Gemessen wird IN der neuen Seite, beim Aufdecken: welcher Typ gesetzt ist
 * (hoch/runter/quer) und ob eine Gruppe fuer das Tourfoto animiert.
 *
 * Aufruf:  node scripts/uebergang-check.mjs [--selbsttest]
 *   --selbsttest liefert ein leeres uebergang.js aus — das Tor MUSS rot werden.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const WURZEL = resolve(import.meta.dirname, '..');
const SELBSTTEST = process.argv.includes('--selbsttest');
const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.webp': 'image/webp', '.ico': 'image/x-icon' };

const server = await new Promise((fertig) => {
  const s = createServer(async (anf, ant) => {
    let pfad = join(WURZEL, decodeURIComponent(anf.url.split('?')[0]));
    if (pfad.endsWith('/')) pfad += 'index.html';
    try {
      let inhalt = await readFile(pfad);
      if (SELBSTTEST && pfad.endsWith('/uebergang.js')) inhalt = Buffer.from('/* leer */');
      ant.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
      ant.end(inhalt);
    } catch { ant.writeHead(404); ant.end('weg'); }
  });
  s.listen(0, () => fertig(s));
});
const BASIS = `http://localhost:${server.address().port}`;

/* Beim Aufdecken der neuen Seite mitschreiben, was der Browser animiert. */
const SONDE = `addEventListener('pagereveal', (e) => {
  window.__vt = { lief: !!e.viewTransition, typen: null, gruppen: null, fertig: false };
  if (!e.viewTransition) { window.__vt.fertig = true; return; }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__vt.typen = [...e.viewTransition.types];
    window.__vt.gruppen = document.getAnimations().map((a) => a.effect && a.effect.pseudoElement)
      .filter((p) => p && p.startsWith('::view-transition-group('));
    window.__vt.fertig = true;
  }));
});`;

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await kontext.addInitScript(SONDE);
const seite = await kontext.newPage();
const befunde = [];
async function lesen() { await seite.waitForFunction(() => window.__vt && window.__vt.fertig, null, { timeout: 5000 }).catch(() => {}); const vt = await seite.evaluate(() => window.__vt || {}); await seite.evaluate(() => { window.__vt = null; }); return vt; }
function pruefen(schritt, vt, typ, tour) {
  const hatTyp = (vt.typen || []).includes(typ);
  const hatFoto = (vt.gruppen || []).includes(`::view-transition-group(${tour})`);
  console.log(`  ${schritt.padEnd(34)} Typ ${hatTyp ? '✓' : '✗'} ${String((vt.typen || []).join(',') || '–').padEnd(7)} Foto ${tour ? (hatFoto ? '✓' : '✗') : '–'}`);
  if (!vt.lief) befunde.push(`${schritt}: kein Uebergang`);
  if (!hatTyp) befunde.push(`${schritt}: Typ ${typ} fehlt`);
  if (tour && !hatFoto) befunde.push(`${schritt}: Tourfoto ${tour} wandert nicht`);
}

await seite.goto(`${BASIS}/touren/`, { waitUntil: 'load' });
await seite.waitForTimeout(600);

// 1) Listenzeile (nicht die Pin-Kachel) -> Tourseite
await seite.locator('.tk-row:has(a[href="/touren/fellhorn/"]) .tk-row__head').click();
await seite.waitForTimeout(500);
await Promise.all([seite.waitForURL('**/touren/fellhorn/'), seite.locator('.tk-row a[href="/touren/fellhorn/"]').first().click()]);
pruefen('Liste -> Fellhorn', await lesen(), 'hoch', 'tour-fellhorn');

// 2) zurueck
await seite.waitForTimeout(700);
await Promise.all([seite.waitForURL(/\/touren\/$/), seite.goBack()]);
pruefen('Fellhorn -> zurueck zur Liste', await lesen(), 'runter', 'tour-fellhorn');

// 3) Pin-Kachel -> Tourseite
await seite.waitForTimeout(700);
await Promise.all([seite.waitForURL('**/touren/hoerndlwand/'), seite.locator('a.tk-pin[href="/touren/hoerndlwand/"]').click()]);
pruefen('Pin -> Hoerndlwand', await lesen(), 'hoch', 'tour-hoerndlwand');

// 4) gleiche Ebene ueber die Nav
await seite.waitForTimeout(700);
await seite.goto(`${BASIS}/partner-picks/`, { waitUntil: 'load' });
await seite.waitForTimeout(600);
await Promise.all([seite.waitForURL(/kooperationen/), seite.locator('.nav a[href*="kooperationen"]').first().click()]);
pruefen('Picks -> Kooperationen (Nav)', await lesen(), 'quer', null);

await browser.close();
server.close();

if (SELBSTTEST) {
  if (befunde.length) { console.log(`\n✓ Selbsttest: ohne uebergang.js schlaegt das Tor an (${befunde.length} Befunde).`); process.exit(0); }
  console.error('\n✗ SELBSTTEST: ohne uebergang.js blieb das Tor gruen — es misst nicht, was es behauptet.'); process.exit(1);
}
if (befunde.length) {
  console.error(`\n✗ uebergang-check: ${befunde.length} Befund(e):`); befunde.forEach((b) => console.error('    ' + b)); process.exit(1);
}
console.log('\n✓ uebergang-check: Richtung stimmt, das Tourfoto wandert — hin, zurueck und von der Pin-Kachel.');
