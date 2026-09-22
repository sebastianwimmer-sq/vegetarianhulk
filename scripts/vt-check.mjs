#!/usr/bin/env node
/* vt-check.mjs — prueft die Seitenwechsel-Kette.
 *
 * WARUM
 * Cross-Document View Transitions fallen auf DREI Arten still aus. Keine
 * davon meldet sich in der Konsole, und keine davon sieht man, wenn man
 * nicht genau darauf achtet — man denkt einfach, der Effekt sei nicht so
 * stark. Belege: docs/lebendig-evidenz.json
 *
 *   1. Eine Seite ohne `@view-transition` — beide Seiten muessen opt-in
 *      machen. Fehlt es auf EINER, gibt es zwischen den beiden keinen
 *      Uebergang. Bei uns steht es in v3.css, also faellt jede Seite aus,
 *      die v3.css nicht laedt.
 *   2. Ein `view-transition-name` ZWEIMAL im selben Dokument. Das bricht
 *      nicht nur diesen einen Namen, sondern den GANZEN Uebergang ab.
 *   3. Ein Name auf der Quellseite ohne Gegenstueck auf der Zielseite.
 *      Dann wird ueberblendet statt bewegt — technisch kein Fehler, aber
 *      genau der Effekt, den wir bauen wollten, fehlt. Deshalb gelb.
 *
 * Gemessen wird am gerenderten Dokument, nicht am Quelltext: ein Name
 * kann aus dem CSS kommen (.nav) statt aus einem style-Attribut.
 *
 * Aufruf:  node scripts/vt-check.mjs [--selbsttest]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const WURZEL = resolve(import.meta.dirname, '..');
const SELBSTTEST = process.argv.includes('--selbsttest');
const PORT = 8247;

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';

/* ---------- Selbsttest: zwei Fixtures, einer muss rot werden ---------- */
function namenZaehlen(namen) {
  const doppelt = new Map();
  for (const n of namen) doppelt.set(n, (doppelt.get(n) || 0) + 1);
  return [...doppelt].filter(([, c]) => c > 1).map(([n, c]) => `${n} (${c}×)`);
}

if (SELBSTTEST) {
  const kaputt = namenZaehlen(['hauptnav', 'tour-a', 'tour-a']);
  const sauber = namenZaehlen(['hauptnav', 'tour-a', 'tour-b']);
  if (kaputt.length !== 1 || !kaputt[0].startsWith('tour-a')) {
    console.error('✗ SELBSTTEST: Dublette nicht erkannt — genau die bricht den ganzen Uebergang ab.');
    process.exit(1);
  }
  if (sauber.length !== 0) {
    console.error('✗ SELBSTTEST: eindeutige Namen faelschlich als Dublette gemeldet.');
    process.exit(1);
  }
  if (!/@view-transition/.test(readFileSync(join(WURZEL, 'v3.css'), 'utf8'))) {
    console.error('✗ SELBSTTEST: v3.css traegt kein @view-transition — die Kette waere tot.');
    process.exit(1);
  }
  console.log('✓ Selbsttest: Dublette wird erkannt, eindeutige Namen nicht, opt-in steht in v3.css.');
  process.exit(0);
}

/* ---------- Lauf ---------- */
let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW}`); process.exit(2); }

const server = spawn('python3', ['-m', 'http.server', String(PORT)],
  { cwd: WURZEL, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const seiten = [];
for (const d of readdirSync(WURZEL)) {
  if (d.endsWith('.html')) seiten.push('/' + d);
}
for (const d of readdirSync(join(WURZEL, 'touren'), { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(join(WURZEL, 'touren', d.name, 'index.html')))
    seiten.push(`/touren/${d.name}/`);
}
seiten.push('/touren/');

const browser = await chromium.launch();
const fehler = [];
const hinweise = [];
const namenJeSeite = new Map();

for (const pfad of seiten) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`http://localhost:${PORT}${pfad}`, { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(() => {
      /* Namen am GERENDERTEN Dokument sammeln: .nav bekommt seinen Namen
         aus dem Stylesheet, nicht aus einem style-Attribut. */
      const namen = [];
      for (const el of document.querySelectorAll('*')) {
        const n = getComputedStyle(el).viewTransitionName;
        if (n && n !== 'none') namen.push(n);
      }
      /* Steht das opt-in in einem geladenen Stylesheet? Eine Seite ohne
         v3.css faellt aus der Kette. */
      let optIn = false;
      for (const bl of document.styleSheets) {
        try {
          for (const regel of bl.cssRules) {
            if (regel.constructor.name === 'CSSViewTransitionRule') { optIn = true; break; }
            if (regel.cssText && regel.cssText.includes('@view-transition')) { optIn = true; break; }
          }
        } catch { /* fremdes Stylesheet — bei uns gibt es keine */ }
        if (optIn) break;
      }
      return { namen, optIn, unterstuetzt: 'startViewTransition' in document };
    });
    namenJeSeite.set(pfad, r.namen);
    const doppelt = namenZaehlen(r.namen);
    if (doppelt.length)
      fehler.push(`${pfad}: Name doppelt — ${doppelt.join(', ')}. Bricht den GANZEN Uebergang ab.`);
    if (!r.optIn)
      fehler.push(`${pfad}: kein @view-transition erreichbar — Seite faellt aus der Kette.`);
    if (!r.namen.includes('hauptnav') && pfad !== '/404.html')
      hinweise.push(`${pfad}: Navigationsleiste ohne Namen — sie blinkt beim Wechsel.`);
  } catch (e) {
    fehler.push(`${pfad}: nicht ladbar (${e.message.split('\n')[0]})`);
  }
  await page.close();
}

/* Gegenstuecke: ein Tour-Name auf dem Hub braucht ihn auch auf der Tourseite. */
const hubNamen = (namenJeSeite.get('/touren/') || []).filter((n) => n.startsWith('tour-'));
for (const n of hubNamen) {
  const slug = n.replace(/^tour-/, '');
  const ziel = namenJeSeite.get(`/touren/${slug}/`) || [];
  if (!ziel.includes(n))
    hinweise.push(`/touren/${slug}/: Hub nennt "${n}", die Tourseite nicht — es wird ueberblendet statt bewegt.`);
}

await browser.close();
server.kill();

if (fehler.length) {
  console.error(`✗ vt-check: ${fehler.length} Befund(e) auf ${seiten.length} Seiten:`);
  fehler.forEach((f) => console.error(`    ${f}`));
  hinweise.forEach((h) => console.error(`  · ${h}`));
  process.exit(1);
}
console.log(`✓ vt-check: ${seiten.length} Seiten, opt-in ueberall, keine doppelten Namen`
  + (hinweise.length ? `, ${hinweise.length} Hinweis(e)` : '') + '.');
hinweise.forEach((h) => console.log(`  · ${h}`));
