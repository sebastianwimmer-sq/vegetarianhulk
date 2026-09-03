#!/usr/bin/env node
/**
 * mail-check.mjs — Tor fuer die E-Mail-Vorlagen in email-templates/.
 *
 *   node scripts/mail-check.mjs                 # alle Vorlagen
 *   node scripts/mail-check.mjs <datei.html>    # eine
 *   node scripts/mail-check.mjs --selbsttest    # beweist, dass es anschlaegt
 *
 * WARUM ES DAS GIBT
 * Am 03.09.2026 kam der Berg-Starter in Gmail (Android, Dark Mode) als
 * dunkler Text auf dunklem Grund an — unlesbar. Ursache war nicht die
 * Gestaltung, sondern eine fehlende Erklaerung: die Vorlage setzte ihre
 * dunklen Flaechen ausschliesslich per CSS. Gmail wertet das beim
 * Dark-Mode-Entscheid nicht zuverlaessig aus, haelt die Mail fuer hell
 * und invertiert die Schrift — waehrend die CSS-Flaeche dunkel bleibt.
 *
 * WAS GEPRUEFT WIRD
 *  1. Jede textfuehrende Flaeche traegt ihren Grund AUCH als bgcolor.
 *  2. Kontrast >= 4,5:1 (bzw. 3:1 ab 24px / 19px fett) wie ausgeliefert.
 *  3. Kein WebP — Outlook zeigt davon nichts an.
 *  4. Keine externen Schrift-/Asset-Hosts (DSGVO, und Outlook laedt sie eh nicht).
 *
 * WAS ES NICHT BEWEIST — bewusst benannt, damit gruen nicht zu viel verspricht:
 * Gmails Dark-Mode-Algorithmus ist nicht oeffentlich und laesst sich hier
 * nicht nachstellen. Das Tor sichert die drei Eigenschaften, die dessen
 * Verhalten bekanntermassen steuern. Der Beweis bleibt eine echte Testmail.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Gleiche Aufloesung wie tour-visual.mjs / a11y-check.mjs: global
   installiertes Playwright, damit die Tore ohne Projekt-Installation laufen. */
const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDNER = join(WURZEL, 'email-templates');
const argv = process.argv.slice(2);
const selbsttest = argv.includes('--selbsttest');

const kanal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
const kontrast = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

/* Welche Vorlagen verschickt der Worker tatsaechlich? Aus den Imports
   gelesen, nicht hier gepflegt — eine Liste von Hand driftet. */
function verschickteVorlagen() {
  try {
    const q = readFileSync(join(WURZEL, 'workers/vh-forms/worker.js'), 'utf8');
    return [...q.matchAll(/import\s+\w+\s+from\s+'([^']*email-templates\/[^']+)'/g)].map(m => basename(m[1]));
  } catch { return []; }
}

/* Bleibt nach dem Versand ein Platzhalter stehen?
   Der Worker ersetzt {{ … }} beim Senden. Passt eine Schreibweise nicht
   mehr — ein Leerzeichen mehr, andere Anfuehrungszeichen —, geht
   "Hey {{ contact.VORNAME … }}" an jeden Empfaenger raus. Kein Kontrast-
   oder Layout-Tor sieht das. Die Ersetzungsliste wird aus worker.js
   gelesen statt hier gepflegt, sonst driften die beiden auseinander. */
function platzhalter(html, dateiname) {
  const worker = join(WURZEL, 'workers/vh-forms/worker.js');
  let quelle;
  try { quelle = readFileSync(worker, 'utf8'); }
  catch { return ['worker.js nicht lesbar — Platzhalter ungeprueft']; }

  /* Nur Vorlagen pruefen, die der Worker auch wirklich verschickt. */
  const importiert = [...quelle.matchAll(/import\s+\w+\s+from\s+'([^']*email-templates\/[^']+)'/g)]
    .map(m => basename(m[1]));
  if (!importiert.includes(dateiname)) return [];

  const alle = [...quelle.matchAll(/\.replaceAll\('([^']*)'\s*,/g)].map(m => m[1])
    .filter(e => e.startsWith('{{'));
  let s = html;
  for (const e of alle) s = s.split(e).join('ERSETZT');
  const rest = [...new Set(s.match(/\{\{[^}]{0,60}\}\}/g) || [])];
  return rest.map(r => `Platzhalter bleibt nach dem Versand stehen: ${r}`);
}

/* Quelltext-Pruefungen: die brauchen keinen Browser. */
function statisch(html) {
  const funde = [];
  if (/\.webp\b/i.test(html)) funde.push('WebP verwendet — Outlook zeigt nichts an');
  const fremd = [...html.matchAll(/https?:\/\/([^/"')\s]+)/g)].map(m => m[1])
    .filter(h => !/vegetarianhulk\.de$|instagram\.com$|schemas\.microsoft\.com$|www\.w3\.org$/.test(h));
  if (fremd.length) funde.push(`fremde Hosts: ${[...new Set(fremd)].join(', ')}`);

  return funde;
}

async function imBrowser(browser, html, breite = 600) {
  const page = await browser.newPage({ viewport: { width: breite, height: 900 } });
  /* Wie ein echter Mail-Client rendern:
     · keine fremden Schriften — Gmail & Co. laden sie nie, und mit
       geladener Webschrift misst man Breiten, die nie vorkommen.
     · kein Standard-Rand des Testbrowsers — die 8px des <body> sind
       ein Artefakt des Messaufbaus und meldeten sonst Phantom-Ueberlauf. */
  await page.route('**://fonts.googleapis.com/**', r => r.abort());
  await page.route('**://fonts.gstatic.com/**', r => r.abort());
  await page.setContent(html, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'body{margin:0}' });
  const funde = await page.evaluate(() => {
    const kanal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
    const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
    const zahl = (s) => (s.match(/[\d.]+/g) || []).map(Number);

    /* Deckenden Grund suchen: halbtransparente Schichten auf den
       darunterliegenden rechnen, statt sie fuer den Grund zu halten. */
    const grundVon = (el) => {
      let n = el, stapel = [];
      while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const v = zahl(bg);
        if (v.length >= 3 && (v[3] === undefined || v[3] > 0)) {
          stapel.push([v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]]);
          if ((v[3] === undefined ? 1 : v[3]) === 1) break;
        }
        n = n.parentElement;
      }
      if (!stapel.length) return [255, 255, 255];
      let grund = stapel.pop().slice(0, 3);
      while (stapel.length) {
        const [r, g, b, a] = stapel.pop();
        grund = [0, 1, 2].map(i => Math.round([r, g, b][i] * a + grund[i] * (1 - a)));
      }
      return grund;
    };

    const raus = [];

    /* bgcolor-Pflicht im DOM statt per Muster pruefen.
       Der erste Anlauf las nur den DIREKTEN Inhalt eines Tags — bei
       verschachtelten Tabellen ist der leer, also meldete er die
       DOI-Vorlage sauber, obwohl sie 7 CSS-Gruende und 1 bgcolor hatte.
       Falsch gruen ist schlimmer als falsch rot: darauf verlaesst man sich. */
    for (const el of document.querySelectorAll('table, td, th, div')) {
      const stil = el.getAttribute('style') || '';
      if (!/background(?:-color)?\s*:/.test(stil)) continue;
      if (el.hasAttribute('bgcolor')) continue;
      const text = (el.textContent || '').replace(/\s| /g, '');
      if (!text) continue;                       // Trennstrich oder leere Huelle
      if (el.tagName === 'DIV') {
        raus.push(`<div> mit Grund und Text — als Tabelle mit bgcolor bauen, sonst invertiert Gmail die Schrift: "${text.slice(0, 32)}"`);
      } else {
        raus.push(`<${el.tagName.toLowerCase()}> setzt den Grund nur per CSS, ohne bgcolor — Gmail invertiert dann die Schrift`);
      }
    }

    for (const el of document.querySelectorAll('*')) {
      const eigen = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!eigen.length) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      const groesse = parseFloat(cs.fontSize);
      const fett = parseInt(cs.fontWeight, 10) >= 700;
      const latte = (groesse >= 24 || (fett && groesse >= 18.66)) ? 3 : 4.5;
      const farbe = zahl(cs.color).slice(0, 3);
      const k = ratio(farbe, grundVon(el));
      if (k < latte) {
        raus.push(`Kontrast ${k.toFixed(2)}:1 (noetig ${latte}) — ${cs.color} bei ${Math.round(groesse)}px: "${eigen[0].textContent.trim().slice(0, 40)}"`);
      }
    }
    return raus;
  });
  await page.close();
  return funde;
}

/* Laeuft die Mail auf einem schmalen Geraet aus dem Rahmen?
   320px, weil Mail-Clients auf kleinen Telefonen so eng werden. */
async function ueberlauf(browser, html) {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  await page.route('**://fonts.googleapis.com/**', r => r.abort());
  await page.route('**://fonts.gstatic.com/**', r => r.abort());
  await page.setContent(html, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'body{margin:0}' });
  const px = await page.evaluate(() =>
    Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await page.close();
  return px > 1 ? [`laeuft bei 320px um ${px}px aus dem Rahmen`] : [];
}

const dateien = argv.filter(a => !a.startsWith('--'));
const liste = dateien.length ? dateien.map(d => (d.includes('/') ? d : join(ORDNER, d)))
                            : readdirSync(ORDNER).filter(f => f.endsWith('.html')).map(f => join(ORDNER, f));

const browser = await chromium.launch();
let gesamt = 0;
let offen = 0;   // Funde in Geruesten: gemeldet, aber nicht blockierend

for (const datei of liste) {
  const html = readFileSync(datei, 'utf8');
  const funde = [...statisch(html), ...platzhalter(html, basename(datei)),
                 ...(await imBrowser(browser, html)), ...(await ueberlauf(browser, html))];
  /* Was der Worker verschickt, blockiert. Ein Blanko-Geruest, das nie
     jemand bekommt, wird GEMELDET, aber blockiert nicht — sonst stuende
     das Tor dauerhaft rot und wuerde nach einer Woche ignoriert.
     Unterdrueckt wird nichts: der Fund steht weiter da, nur anders gewichtet. */
  const wirdVerschickt = verschickteVorlagen().includes(basename(datei));
  if (wirdVerschickt) gesamt += funde.length; else offen += funde.length;
  const zeichen = funde.length ? (wirdVerschickt ? '🔴' : '🟡') : '🟢';
  const art = wirdVerschickt ? 'verschickt' : 'Geruest';
  console.log(`${zeichen} ${basename(datei).padEnd(30)} ${art.padEnd(11)} ${funde.length ? funde.length + ' Fund(e)' : 'sauber'}`);
  funde.slice(0, 8).forEach(f => console.log('     · ' + f + (wirdVerschickt ? '' : '  (blockiert nicht)')));
}

if (selbsttest) {
  /* Zwei Fixtures: ein kaputter Fall MUSS anschlagen, ein sauberer NICHT.
     Ein Waechter, den man nie hat anschlagen sehen, ist keiner. */
  const kaputt = '<table style="background-color:#0B2418"><tr><td style="color:#123018;font-size:14px">Kaum lesbar</td></tr></table>';
  const sauber = '<table bgcolor="#0B2418" style="background-color:#0B2418"><tr><td bgcolor="#0B2418" style="background-color:#0B2418;color:#F5EEDD;font-size:14px">Gut lesbar</td></tr></table>';
  const a = [...statisch(kaputt), ...(await imBrowser(browser, kaputt))];
  const b = [...statisch(sauber), ...(await imBrowser(browser, sauber))];
  console.log(`\nSelbsttest  kaputt → ${a.length ? '🟢 schlaegt an (' + a.length + ')' : '🔴 BLIND'}`);
  console.log(`Selbsttest  sauber → ${b.length ? '🔴 Fehlalarm (' + b.join('; ') + ')' : '🟢 bleibt still'}`);
  if (!a.length || b.length) process.exit(2);
}

console.log(gesamt ? `\n${gesamt} blockierende(r) Fund(e).`
  : offen ? `\nVerschickte Vorlagen sauber. ${offen} Fund(e) in Geruest-Vorlagen — nicht blockierend, aber offen.`
  : '\nAlle Vorlagen sauber.');
console.log('Nicht abgedeckt: Gmails Dark-Mode-Algorithmus ist nicht oeffentlich —\n' +
            'das Tor sichert die Eigenschaften, die ihn steuern, ersetzt aber keine Testmail.');
await browser.close();
process.exit(gesamt ? 1 : 0);
