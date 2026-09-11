#!/usr/bin/env node
/**
 * mail-loop.mjs — misst das NIVEAU einer fertigen Mail, nicht nur ihre Fehler.
 *
 *   node scripts/mail-loop.mjs .mail-versand/drachenwand.html
 *   node scripts/mail-loop.mjs <datei> --merken     # Stand als Vergleich sichern
 *   node scripts/mail-loop.mjs <datei> --vergleich  # gegen den gemerkten Stand
 *
 * WARUM ES DAS GIBT
 * "sieht noch schwach aus vom level her" ist ein richtiges Urteil, mit dem sich
 * nicht arbeiten laesst. mail-check.mjs prueft, ob etwas KAPUTT ist. Dieses
 * Werkzeug prueft, ob es GUT ist — und macht die Begriffe zaehlbar:
 *
 *   Rhythmus      Wie viele verschiedene senkrechte Abstaende? Eine Mail mit
 *                 neun verschiedenen Luecken hat keinen Takt, sondern Zufall.
 *   Monotonie     Wie viele verschiedene Inhaltsbreiten? Alles gleich breit
 *                 untereinander liest sich als Liste, nicht als Komposition.
 *   Typo-Stufen   Abstand zwischen den Schriftgroessen. Unter 1,25 wirken zwei
 *                 Stufen wie ein Versehen statt wie Hierarchie.
 *   Dark-Mode     Anteil der Textzellen mit eigenem bgcolor. Gmail urteilt pro
 *                 Element; eine Zelle ohne Grund bekommt dunkle Schrift.
 *   Dichte        Laengster Absatz und Zeilenlaenge.
 *
 * WAS ES NICHT KANN
 * Es sagt nicht, ob die Mail schoen ist. Es sagt, wo sie mechanisch wirkt.
 * Die Entscheidung, was daraus folgt, bleibt am Menschen — deshalb "Loop":
 * messen, aendern, wieder messen, und die Differenz ansehen.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW}`); process.exit(2); }

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const datei = argv.find(a => !a.startsWith('--'));
const merken = argv.includes('--merken');
const vergleichen = argv.includes('--vergleich');
if (!datei) { console.error('Aufruf: node scripts/mail-loop.mjs <datei.html> [--merken|--vergleich]'); process.exit(2); }

const STAND = join(WURZEL, '.mail-versand', `.loop-${basename(datei)}.json`);

const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 600, height: 900 } });
/* Wie ein echter Client: keine fremden Schriften, kein Browser-Rand.
   Mit geladener Webschrift misst man Groessen, die nie vorkommen. */
await seite.route('**://fonts.googleapis.com/**', r => r.abort());
await seite.route('**://fonts.gstatic.com/**', r => r.abort());
await seite.setContent(readFileSync(datei, 'utf8'), { waitUntil: 'load' });
await seite.addStyleTag({ content: 'body{margin:0}' });

const mess = await seite.evaluate(() => {
  const karte = document.querySelector('table table') || document.body;
  const bloecke = [...karte.querySelectorAll(':scope > tbody > tr')]
    .map(tr => ({ el: tr, b: tr.getBoundingClientRect() }))
    .filter(x => x.b.height > 2);

  /* Rhythmus: die Luecken zwischen den Bloecken. Innenabstand zaehlt mit,
     denn gesehen wird der Weissraum, nicht das Kaestchen. */
  const luecken = [];
  for (let i = 1; i < bloecke.length; i++) {
    const l = Math.round(bloecke[i].b.top - bloecke[i - 1].b.bottom);
    if (l >= 0) luecken.push(l);
  }
  /* Innenabstaende oben/unten je Block — das ist der eigentliche Takt */
  const takte = bloecke.map(x => {
    const td = x.el.querySelector(':scope > td');
    if (!td) return null;
    const cs = getComputedStyle(td);
    return { oben: Math.round(parseFloat(cs.paddingTop)), unten: Math.round(parseFloat(cs.paddingBottom)) };
  }).filter(Boolean);

  /* Monotonie: wie viele verschiedene Inhaltsbreiten gibt es? */
  const breiten = bloecke.map(x => {
    const td = x.el.querySelector(':scope > td');
    if (!td) return null;
    const cs = getComputedStyle(td);
    return Math.round(x.b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  }).filter(Boolean);

  /* Typo: welche Groessen tragen wirklich Text? */
  const groessen = new Map();   // Lesegroessen
  const etiketten = new Map();  // Versalien-Register
  for (const el of document.querySelectorAll('*')) {
    /* <style> und <script> tragen Textknoten, aber keinen gelesenen Text —
       der Inhalt des style-Blocks erschien sonst als 16px-Stufe.
       Unsichtbares ebenso: der versteckte Vorschautext steht auf 1px und
       war damit eine "Typo-Stufe", die niemand je sieht. */
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
    const eigen = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!eigen.length) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const px = Math.round(parseFloat(cs.fontSize) * 10) / 10;
    const zeichen = eigen.reduce((a, n) => a + n.textContent.trim().length, 0);
    /* Versalien mit weiter Sperrung (Eyebrows, Etiketten, Wortmarke) sind ein
       eigenes REGISTER, keine weitere Stufe derselben Leiter. Sie mit der
       Lesegroesse zu vergleichen erzwingt eine Skala, die es nicht gibt —
       und haette mich beinahe dazu gebracht, die Wortmarke zu vergroessern,
       bis die Mail wieder aus dem Rahmen laeuft. */
    const sperrung = parseFloat(cs.letterSpacing) || 0;
    const etikett = sperrung / parseFloat(cs.fontSize) >= 0.1;
    const ziel = etikett ? etiketten : groessen;
    ziel.set(px, (ziel.get(px) || 0) + zeichen);
  }

  /* Dark-Mode-Bereitschaft: Textzellen mit eigenem bgcolor */
  const zellen = [...document.querySelectorAll('td')].filter(td => (td.textContent || '').trim().length > 1);
  const mitGrund = zellen.filter(td => td.hasAttribute('bgcolor')).length;

  /* Dichte: laengster Absatz, Zeilenlaenge */
  const absaetze = [...document.querySelectorAll('p, div')]
    .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 40))
    .map(e => {
      const t = e.textContent.trim().replace(/\s+/g, ' ');
      const cs = getComputedStyle(e);
      const zeichenBreite = parseFloat(cs.fontSize) * 0.5;   // grobe Mittelwertbreite
      return { woerter: t.split(' ').length, ch: Math.round(e.getBoundingClientRect().width / zeichenBreite) };
    });

  /* Doppelung: sagen zwei Bloecke dasselbe? Kein Tor sucht danach, aber
     nichts laesst eine Mail duenner wirken als derselbe Satz zweimal
     innerhalb von 300 Pixeln. Gemessen an gemeinsamen Inhaltswoertern. */
  const texte = [...document.querySelectorAll('p, div')]
    .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 60))
    .map(e => e.textContent.trim().replace(/\s+/g, ' '))
    .filter(t => !/^Du bekommst diese Mail/.test(t));
  const woerter = (t) => new Set(t.toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(w => w.length > 4));
  let doppelung = 0, paar = null;
  for (let i = 0; i < texte.length; i++) for (let j = i + 1; j < texte.length; j++) {
    const a = woerter(texte[i]), b = woerter(texte[j]);
    if (a.size < 4 || b.size < 4) continue;
    const gemeinsam = [...a].filter(w => b.has(w)).length;
    const quote = Math.round(gemeinsam / Math.min(a.size, b.size) * 100);
    if (quote > doppelung) { doppelung = quote; paar = [texte[i].slice(0, 44), texte[j].slice(0, 44)]; }
  }

  return {
    doppelung, doppelPaar: paar,
    bloecke: bloecke.length,
    luecken,
    takte,
    breiten,
    groessen: [...groessen.entries()].sort((a, b) => b[0] - a[0]),
    etiketten: [...etiketten.entries()].sort((a, b) => b[0] - a[0]),
    zellen: zellen.length, mitGrund,
    absaetze,
    hoehe: Math.round(document.body.scrollHeight),
  };
});
await browser.close();

/* ---------- Bewertung ---------- */
const einzig = (a) => [...new Set(a)];
const takteAlle = einzig(mess.takte.flatMap(t => [t.oben, t.unten]).filter(v => v > 0));
const breitenEinzig = einzig(mess.breiten);
const gr = mess.groessen.map(g => g[0]);
const stufen = [];
for (let i = 1; i < gr.length; i++) stufen.push(Math.round((gr[i - 1] / gr[i]) * 100) / 100);
const engeStufen = stufen.filter(v => v < 1.25);
const darkAnteil = mess.zellen ? Math.round(mess.mitGrund / mess.zellen * 100) : 0;
const langster = mess.absaetze.reduce((a, b) => (b.woerter > (a?.woerter ?? 0) ? b : a), null);
const zuBreit = mess.absaetze.filter(a => a.ch > 75).length;

const werte = {
  bloecke: mess.bloecke,
  takt_werte: takteAlle.length,
  breiten_werte: breitenEinzig.length,
  typo_stufen: gr.length,
  typo_zu_eng: engeStufen.length,
  dark_prozent: darkAnteil,
  laengster_absatz: langster?.woerter ?? 0,
  absaetze_ueber_75ch: zuBreit,
  doppelung: mess.doppelung,
  hoehe: mess.hoehe,
};

const zeile = (gut, name, wert, soll) =>
  console.log(`  ${gut ? '✓' : '·'} ${name.padEnd(30)} ${String(wert).padStart(8)}   ${soll}`);

console.log(`\n── Niveau: ${basename(datei)} ──`);
zeile(takteAlle.length <= 4, 'Takt (verschiedene Abstände)', takteAlle.length, `${takteAlle.join('/')}  · ≤4 ergibt Rhythmus`);
zeile(breitenEinzig.length >= 2, 'Inhaltsbreiten', breitenEinzig.length, `${breitenEinzig.join('/')}  · 1 = Liste statt Komposition`);
zeile(engeStufen.length === 0, 'Typo-Stufen unter 1,25', engeStufen.length, `Lesegrößen ${gr.join('/')}`);
const et = mess.etiketten.map(e => e[0]);
zeile(et.length <= 2, 'Etiketten-Register (Versalien)', et.length, `${et.join('/')} · ≤2 reicht`);
zeile(darkAnteil === 100, 'Textzellen mit eigenem Grund', `${darkAnteil}%`, `${mess.mitGrund}/${mess.zellen} · Gmail urteilt pro Element`);
zeile((langster?.woerter ?? 0) <= 55, 'längster Absatz (Wörter)', langster?.woerter ?? 0, '≤55, sonst wird übersprungen');
zeile(zuBreit === 0, 'Absätze über 75 Zeichen breit', zuBreit, 'Lesbarkeit');
zeile(mess.doppelung < 40, 'Doppelung zwischen Blöcken', `${mess.doppelung}%`,
      mess.doppelPaar ? `„${mess.doppelPaar[0]}…" ↔ „${mess.doppelPaar[1]}…"` : '—');
console.log(`    ${'Gesamthöhe'.padEnd(30)} ${String(mess.hoehe).padStart(8)}   px bei 600 Breite`);

if (vergleichen && existsSync(STAND)) {
  const alt = JSON.parse(readFileSync(STAND, 'utf8'));
  console.log('\n── Veränderung gegenüber dem gemerkten Stand ──');
  let etwas = false;
  for (const [k, v] of Object.entries(werte)) {
    if (alt[k] === undefined || alt[k] === v) continue;
    etwas = true;
    const pfeil = (typeof v === 'number' && v > alt[k]) ? '↑' : '↓';
    console.log(`  ${pfeil} ${k.padEnd(28)} ${alt[k]} → ${v}`);
  }
  if (!etwas) console.log('  keine messbare Veränderung');
} else if (vergleichen) {
  console.log('\n  (kein gemerkter Stand — erst mit --merken sichern)');
}

if (merken) {
  mkdirSync(dirname(STAND), { recursive: true });
  writeFileSync(STAND, JSON.stringify(werte, null, 1), 'utf8');
  console.log(`\n  Stand gemerkt: ${basename(STAND)}`);
}

console.log('\n  Was hier NICHT steht: ob die Mail schön ist. Das Werkzeug zeigt,');
console.log('  wo sie mechanisch wirkt — ansehen muss man sie trotzdem.\n');
