#!/usr/bin/env node
/**
 * tour-visual.mjs — misst eine Tour-Seite in vier Engines und schiesst Bilder.
 *
 *   node scripts/tour-visual.mjs <slug> [<slug> …]
 *   node scripts/tour-visual.mjs --alle
 *
 * Warum es dieses Werkzeug gibt — zwei Messfehler, die Zeit gekostet haben:
 *
 * 1. NIE ueber file:// messen. Die Seiten binden `/v3.css` absolut ein; unter
 *    file:// zeigt das auf die Wurzel des Dateisystems, das Stylesheet laedt
 *    nicht und jede Overflow-Zahl ist Muell. Ein Lauf meldete so 40px Ueberlauf,
 *    der ueber HTTP 0px war. Dieses Skript startet sich seinen eigenen Server.
 *
 * 2. Lazy-Bilder erst NACH dem Durchscrollen zaehlen. Vorher zaehlt man
 *    normales Lazy-Verhalten als Defekt. Umgekehrt faellt so ein echter Fehler
 *    auf: am 02.09. waren drei Fotos in WebKit dauerhaft leer, weil sie 0x0 gross
 *    waren (`position: static` nahm ihnen die Bezugshoehe) — ein 0x0-Bild kommt
 *    nie in den Viewport, also laedt `loading="lazy"` es nie nach. In Chromium
 *    war alles gruen.
 *
 * Exit 1 bei Ueberlauf, nicht geladenen Bildern oder JS-Fehlern.
 */
import { spawn } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8231;
const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
const BILDER = join(WURZEL, '.tour-visual');

const GERAETE = [
  ['webkit-390', 'webkit', { width: 390, height: 844 }],
  ['webkit-768', 'webkit', { width: 768, height: 1024 }],
  ['firefox-1024', 'firefox', { width: 1024, height: 800 }],
  ['chromium-1440', 'chromium', { width: 1440, height: 900 }],
];

const argv = process.argv.slice(2);
const slugs = argv.includes('--alle') || !argv.length
  ? readdirSync(join(WURZEL, 'touren'), { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'assets').map(e => e.name)
  : argv.filter(a => !a.startsWith('--'));

let pw;
try { pw = await import(PW); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
const aufraeumen = () => { try { server.kill(); } catch {} };
process.on('exit', aufraeumen);
process.on('SIGINT', () => { aufraeumen(); process.exit(130); });
await new Promise(r => setTimeout(r, 1200));
mkdirSync(BILDER, { recursive: true });

let befunde = 0;
for (const slug of slugs) {
  for (const [name, engineName, viewport] of GERAETE) {
    const browser = await pw[engineName].launch();
    const seite = await browser.newPage({ viewport });
    const jsFehler = [];
    seite.on('pageerror', e => jsFehler.push(e.message));

    await seite.goto(`http://localhost:${PORT}/touren/${slug}/`, { waitUntil: 'load' });
    // wie ein echter Besucher durchscrollen, damit lazy und IntersectionObserver greifen
    await seite.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 80));
      }
    });
    await seite.waitForTimeout(2200);

    const mess = await seite.evaluate(() => {
      const d = document.documentElement;
      const bilder = [...document.images];
      return {
        ueberlauf: d.scrollWidth - d.clientWidth,
        leer: bilder.filter(i => !(i.complete && i.naturalWidth > 0))
                    .map(i => i.currentSrc.split('/').pop() || i.getAttribute('src')),
        ohneFlaeche: bilder.filter(i => {
          const r = i.getBoundingClientRect();
          return r.width === 0 || r.height === 0;
        }).map(i => i.getAttribute('src').split('/').pop()),
        // Ein Hoehenprofil ohne gezeichnete Kurve sah fuer das Werkzeug "sauber" aus:
        // ein NaN in den Koordinaten wirft keinen Fehler, es zeichnet nur nichts.
        profilLeer: (() => {
          const linie = document.querySelector('.tour-profil .line');
          if (!linie) return null;
          const d = linie.getAttribute('d') || '';
          if (/NaN|undefined/.test(d)) return 'Koordinaten enthalten NaN';
          try { if (linie.getTotalLength() < 50) return 'Kurve zu kurz'; } catch { return 'Pfad unlesbar'; }
          const achsen = document.querySelectorAll('.tour-profil__tick').length;
          if (document.querySelector('.tour-svg[data-punkte]') && !achsen) return 'keine Achsenbeschriftung';
          return null;
        })(),
      };
    });

    const schlecht = mess.ueberlauf > 0 || mess.leer.length || mess.ohneFlaeche.length || jsFehler.length || mess.profilLeer;
    if (schlecht) befunde++;
    const details = [
      mess.ueberlauf > 0 ? `Ueberlauf ${mess.ueberlauf}px` : null,
      mess.leer.length ? `nicht geladen: ${mess.leer.join(', ')}` : null,
      mess.ohneFlaeche.length ? `0x0 gross: ${mess.ohneFlaeche.join(', ')}` : null,
      mess.profilLeer ? `Hoehenprofil: ${mess.profilLeer}` : null,
      jsFehler.length ? `JS: ${jsFehler[0].slice(0, 70)}` : null,
    ].filter(Boolean).join(' · ');
    console.log(`${schlecht ? '🔴' : '🟢'} ${slug.padEnd(16)} ${name.padEnd(15)} ${details || 'sauber'}`);

    await seite.evaluate(() => window.scrollTo(0, 0));
    await seite.waitForTimeout(400);
    await seite.screenshot({ path: join(BILDER, `${slug}-${name}.png`), fullPage: true });
    await browser.close();
  }
}

aufraeumen();
console.log(`\nScreenshots: ${BILDER}  —  selbst ansehen, gruen allein ist kein Qualitaetsnachweis.`);
process.exit(befunde ? 1 : 0);
