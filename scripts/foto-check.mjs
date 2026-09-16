#!/usr/bin/env node
/* foto-check.mjs — misst, wie viel von jedem Foto weggeschnitten wird.
 *
 * WARUM DIESES TOR
 * Am 16.09.2026 stand auf den Tourseiten ein 3:4-Foto in einer 344x1107-Saeule
 * und verlor 59 % seines Bildes. Ursache war kein Fehler am Bild, sondern die
 * Nachbarschaft: `.tour-shot` hatte keine eigene Hoehe und wuchs auf die Hoehe
 * seiner Rasterzeile — daneben stand die hohe Routenkarte. Gemerkt hat es
 * Sebi, kein Werkzeug. Jede Pruefung, die den Quelltext liest, haette gruen
 * gemeldet: das Markup war fehlerfrei.
 *
 * Deshalb wird hier GEMESSEN, im Browser, an der gerenderten Box — und zwar
 * auf beiden Breiten, weil die Handy-Regeln eigene Seitenverhaeltnisse setzen.
 *
 * Kacheln mit `spannt-2` binden bewusst zwei Rasterzeilen; dort ist Beschnitt
 * Absicht und wird nur berichtet.
 *
 * Aufruf:  node scripts/foto-check.mjs [--selbsttest]
 * Exit 1, sobald ein Foto mehr als GRENZE verliert.
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

// Gleicher Pfad wie in tour-visual.mjs: playwright liegt global, nicht im Repo.
const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const WURZEL = resolve(import.meta.dirname, '..');
const GRENZE = 35;          // Prozent, ab hier ist es ein Befund
const GRENZE_GEBUNDEN = 45; // fuer `spannt-2`: bewusst, aber nicht beliebig
const BREITEN = [[1440, 900, 'desktop'], [390, 844, 'handy']];

const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function server() {
  return new Promise((fertig) => {
    const s = createServer(async (anfrage, antwort) => {
      let pfad = join(WURZEL, decodeURIComponent(anfrage.url.split('?')[0]));
      if (pfad.endsWith('/')) pfad += 'index.html';
      // Erst lesen, DANN Kopfzeilen schreiben. Andersherum steht bei einer
      // fehlenden Datei schon ein 200 in der Leitung und der 404 wirft
      // ERR_HTTP_HEADERS_SENT — das Tor stirbt dann an sich selbst.
      try {
        const inhalt = await readFile(pfad);
        antwort.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
        antwort.end(inhalt);
      } catch { antwort.writeHead(404); antwort.end('weg'); }
    });
    s.listen(0, () => fertig({ s, port: s.address().port }));
  });
}

async function touren() {
  const eintraege = await readdir(join(WURZEL, 'touren'), { withFileTypes: true });
  return eintraege.filter((e) => e.isDirectory()
    && existsSync(join(WURZEL, 'touren', e.name, 'index.html'))).map((e) => e.name);
}

async function messen(seite) {
  /* Erst ganz durchscrollen: lazy geladene Bilder haben sonst keine
     natuerliche Groesse, und `naturalWidth` waere 0 — das Tor haette dann
     nichts zu messen und faelschlich gruen gemeldet. */
  await seite.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 700));
    window.scrollTo(0, 0);
  });
  /* Deterministisch warten, bis JEDES Bild wirklich geladen ist. Vorher stand
     hier eine feste Frist — unter Last (die Tore laufen hintereinander, jedes
     mit eigenem Browser) reichte sie einmal nicht, und der Lauf wurde rot,
     waehrend derselbe Test allein gruen war. Ein Tor, das mal so und mal so
     ausgeht, wird ignoriert. */
  await seite.waitForFunction(() => {
    const b = [...document.querySelectorAll('.tour-shot img')];
    return b.length === 0 || b.every((i) => i.complete && i.naturalWidth > 0);
  }, { timeout: 15000 }).catch(() => {});
  await seite.waitForTimeout(150);
  return seite.evaluate(() => [...document.querySelectorAll('.tour-shot img')].map((bild) => {
    const kasten = bild.getBoundingClientRect();
    if (!kasten.width || !bild.naturalWidth) return null;
    const kastenV = kasten.width / kasten.height;
    const bildV = bild.naturalWidth / bild.naturalHeight;
    const sichtbar = kastenV > bildV ? bildV / kastenV : kastenV / bildV;
    return {
      datei: (bild.currentSrc || bild.src).split('/').pop(),
      weg: Math.round((1 - sichtbar) * 100),
      kasten: `${Math.round(kasten.width)}×${Math.round(kasten.height)}`,
      gebunden: !!bild.closest('.spannt-2'),
    };
  }).filter(Boolean));
}

const SELBSTTEST = process.argv.includes('--selbsttest');

const { s, port } = await server();
const browser = await chromium.launch();

if (SELBSTTEST) {
  /* Der alte Zustand wird im BROWSER wiederhergestellt, nicht auf der Platte:
     `aspect-ratio: auto` + `align-self: stretch` ist genau das Verhalten von
     vor dem Fix. Kein Kopieren des Baums, kein Aufraeumen, kein Risiko fuer
     fremde Dateien — und der Test misst dieselbe Groesse wie der Ernstfall. */
  const slugs = await touren();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const seite = await kontext.newPage();
  await seite.goto(`http://localhost:${port}/touren/${slugs[0]}/`, { waitUntil: 'networkidle' });
  const vorher = (await messen(seite)).map((f) => f.weg);
  await seite.addStyleTag({ content:
    '.tour-shot{aspect-ratio:auto !important;align-self:stretch !important;min-height:260px}' });
  const nachher = (await messen(seite)).map((f) => f.weg);
  await kontext.close();
  await browser.close();
  s.close();

  const schlimmer = Math.max(...nachher) > Math.max(...vorher, 0);
  const faellt_auf = Math.max(...nachher) > GRENZE;
  console.log(`  ohne eigene Form: ${nachher.join('% ')}%`);
  console.log(`  mit eigener Form: ${vorher.join('% ')}%`);
  if (!schlimmer || !faellt_auf) {
    console.error('✗ SELBSTTEST: der Rueckbau hat den Beschnitt nicht ueber die Grenze '
      + 'gehoben — das Tor kann seinen eigenen Fehlerfall nicht sehen.');
    process.exit(1);
  }
  console.log(`✓ Selbsttest: ohne eigene Form fallen Kacheln ueber ${GRENZE} %, mit nicht.`);
  process.exit(0);
}
const befunde = [];
const hinweise = [];
let gemessen = 0;

for (const slug of await touren()) {
  for (const [breite, hoehe, name] of BREITEN) {
    const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } });
    const seite = await kontext.newPage();
    await seite.goto(`http://localhost:${port}/touren/${slug}/`, { waitUntil: 'networkidle' });
    for (const f of await messen(seite)) {
      gemessen++;
      const grenze = f.gebunden ? GRENZE_GEBUNDEN : GRENZE;
      const zeile = `${slug}/${name}: ${f.datei} verliert ${f.weg} % (Box ${f.kasten})`;
      if (f.weg > grenze) befunde.push(zeile);
      else if (f.gebunden && f.weg >= GRENZE) hinweise.push(zeile + ' — spannt-2, Absicht');
    }
    await kontext.close();
  }
}
await browser.close();
s.close();

if (!gemessen) {
  console.error('✗ foto-check: KEIN Foto gemessen — das ist ein Befund, keine Entwarnung.');
  process.exit(1);
}

for (const z of hinweise) console.log(`  · ${z}`);
if (befunde.length) {
  console.error(`\n✗ foto-check: ${befunde.length} Foto(s) verlieren mehr als ${GRENZE} %:`);
  for (const z of befunde) console.error(`    ${z}`);
  console.error('\n  Meist ist nicht das Bild schuld, sondern die Nachbarschaft:');
  console.error('  eine Kachel ohne eigene Form waechst auf die Hoehe ihrer Rasterzeile.');
  console.error('  `python3 scripts/foto-format.py` gibt jeder Kachel die Form ihres Bildes.');
  process.exit(1);
}
console.log(`✓ foto-check: ${gemessen} Messungen, keine Kachel über ${GRENZE} %.`);
