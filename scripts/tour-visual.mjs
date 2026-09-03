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
import { readdirSync, mkdirSync, readFileSync } from 'node:fs';
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

/* Alle Seiten der Site, die den v3-Look laden — fuer --site.
   Der Rest der Site war bis 02.09.2026 nie mitgemessen worden. */
function v3Seiten() {
  const treffer = [];
  const suche = (verzeichnis, tiefe) => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.name.startsWith('.') || eintrag.name === 'node_modules'
          || eintrag.name === 'design' || eintrag.name === 'fonts') continue;
      const voll = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory() && tiefe < 2) suche(voll, tiefe + 1);
      else if (eintrag.name.endsWith('.html')) {
        if (readFileSync(voll, 'utf8').includes('v3.css')) {
          treffer.push('/' + voll.slice(WURZEL.length + 1).replace(/index\.html$/, ''));
        }
      }
    }
  };
  suche(WURZEL, 0);
  return treffer.sort();
}

const siteModus = argv.includes('--site');
const slugs = siteModus
  ? v3Seiten()
  : (argv.includes('--alle') || !argv.length
      ? readdirSync(join(WURZEL, 'touren'), { withFileTypes: true })
          .filter(e => e.isDirectory() && e.name !== 'assets').map(e => e.name)
      : argv.filter(a => !a.startsWith('--')));

let pw;
try { pw = await import(PW); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const SERVER_CODE = [
  'import sys, http.server, socketserver',
  'class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True',
  'h = http.server.SimpleHTTPRequestHandler',
  'h.log_message = lambda *a, **k: None',
  'S(("127.0.0.1", int(sys.argv[1])), h).serve_forever()',
].join('\n');
const server = spawn('python3', ['-c', SERVER_CODE, String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
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
    const bekannt = [];
    /* Turnstile wirft in WebKit einen cross-origin-Fehler gegen
       challenges.cloudflare.com — auch live, auch ohne unser Zutun, und in
       Chromium gar nicht. Der Widget-Modus laesst sich nur im
       Cloudflare-Dashboard aendern. Als Fehler gezaehlt stuende dieses Tor
       dauerhaft rot und wuerde nach einer Woche ignoriert; verschwiegen waere
       es genauso falsch. Deshalb: sichtbar, aber nicht blockierend. */
    const IST_BEKANNT = /challenges\.cloudflare\.com/;
    seite.on('pageerror', e => (IST_BEKANNT.test(e.message) ? bekannt : jsFehler).push(e.message));

    const url = siteModus ? `http://localhost:${PORT}${slug}` : `http://localhost:${PORT}/touren/${slug}/`;
    await seite.goto(url, { waitUntil: 'load' });
    // wie ein echter Besucher durchscrollen, damit lazy und IntersectionObserver greifen
    await seite.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 80));
      }
    });
    // Deterministisch warten statt fester Frist: der Lauf meldete sonst
    // sporadisch ein Bild als "nicht geladen", das bei drei Wiederholungen
    // jedes Mal da war. Ein Tor, das mal rot und mal gruen ist, wird ignoriert.
    await seite.waitForFunction(
      () => [...document.images].every(i => i.complete && i.naturalWidth > 0),
      null, { timeout: 15000 }
    ).catch(() => { /* wirklich haengende Bilder faengt die Messung unten ab */ });
    await seite.waitForTimeout(600);

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

    // Ein Befund muss sich bestaetigen. Im Site-Lauf (13 Seiten x 4 Engines,
    // jeweils frischer Browser) meldete WebKit-390 auf dem Hub reproduzierbar
    // ein Bild als "nicht geladen", das isoliert in vier Laeufen immer da war.
    // Die Ursache liegt in der Umgebung des Durchlaufs, nicht auf der Seite —
    // deshalb wird nur ein Befund gemeldet, der eine Wiederholung ueberlebt.
    // Ein Tor, das mal rot und mal gruen ist, wird nach einer Woche ignoriert.
    let schlecht = mess.ueberlauf > 0 || mess.leer.length || mess.ohneFlaeche.length
                   || jsFehler.length || mess.profilLeer;
    if (schlecht && !jsFehler.length && !mess.ueberlauf) {
      await seite.reload({ waitUntil: 'load' });
      await seite.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 300) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 80));
        }
      });
      await seite.waitForFunction(
        () => [...document.images].every(i => i.complete && i.naturalWidth > 0),
        null, { timeout: 15000 }
      ).catch(() => {});
      const zweit = await seite.evaluate(() => {
        const bilder = [...document.images];
        const linie = document.querySelector('.tour-profil .line');
        return {
          leer: bilder.filter(i => !(i.complete && i.naturalWidth > 0)).length,
          ohneFlaeche: bilder.filter(i => {
            const r = i.getBoundingClientRect();
            return r.width === 0 || r.height === 0;
          }).length,
          kurveKurz: linie ? linie.getTotalLength() < 50 : false,
        };
      });
      if (!zweit.leer && !zweit.ohneFlaeche && !zweit.kurveKurz) {
        schlecht = false;
        mess.leer = []; mess.ohneFlaeche = []; mess.profilLeer = null;
        mess.wackelig = true;
      }
    }
    if (schlecht) befunde++;
    const details = [
      mess.ueberlauf > 0 ? `Ueberlauf ${mess.ueberlauf}px` : null,
      mess.leer.length ? `nicht geladen: ${mess.leer.join(', ')}` : null,
      mess.ohneFlaeche.length ? `0x0 gross: ${mess.ohneFlaeche.join(', ')}` : null,
      mess.profilLeer ? `Hoehenprofil: ${mess.profilLeer}` : null,
      jsFehler.length ? `JS: ${jsFehler[0].slice(0, 70)}` : null,
    ].filter(Boolean).join(' · ');
    const bezeichner = (siteModus ? slug : slug).padEnd(siteModus ? 26 : 16);
    const anhang = bekannt.length ? `  (${bekannt.length}x bekannter Turnstile-Fremdfehler)` : '';
    console.log(`${schlecht ? '🔴' : '🟢'} ${bezeichner} ${name.padEnd(15)} ${details || (mess.wackelig ? 'sauber (erst im 2. Anlauf)' : 'sauber')}${anhang}`);

    await seite.evaluate(() => window.scrollTo(0, 0));
    await seite.waitForTimeout(400);
    const dateiname = slug.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'start';
    await seite.screenshot({ path: join(BILDER, `${dateiname}-${name}.png`), fullPage: true });
    await browser.close();
  }
}

aufraeumen();
console.log(`\nScreenshots: ${BILDER}  —  selbst ansehen, gruen allein ist kein Qualitaetsnachweis.`);
process.exit(befunde ? 1 : 0);
