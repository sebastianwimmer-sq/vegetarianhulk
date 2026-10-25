#!/usr/bin/env node
/**
 * Erzeugt die englischen Newsletter-Flaechen aus ihrer deutschen Quelle (Sebi 25.10.2026:
 * Newsletter zweisprachig, „immer beides 1/1“). Die deutsche Datei bleibt die EINE Quelle;
 * die englische ist sie, Zeile fuer Zeile uebersetzt (scripts/en-tabellen.mjs). Trifft eine
 * Zeile die Quelle nicht mehr (Text geaendert), bricht der Bau ab — so kann die englische
 * Fassung weder im Design noch im Inhalt still auseinanderlaufen.
 *
 * Danach immer: node scripts/sprachen-bauen.mjs (Umschalter, hreflang) und csp-haerten.mjs.
 *
 *   node scripts/en-flaechen.mjs            schreibt alle englischen Dateien
 *   node scripts/en-flaechen.mjs --pruefen  Tor: Dateien aktuell + kein Deutsch (Exit 1 sonst)
 *   node scripts/en-flaechen.mjs --selbsttest
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { FLAECHEN } from './en-tabellen.mjs';
import { sichtbarerText, stempelZeile } from './sprachen.mjs';

// Wie scripts/sprachen-check.mjs: deutsche Funktionswoerter im sichtbaren Text.
const DEUTSCH = /\b(und|der|die|das|nicht|mit|für|dein|deine|wir|du|ist|zum|zur|bei|eine?|auf|von|den|dem|noch|auch|sich|ich|mein|meine)\b/g;
// Was auf einer englischen Flaeche deutsch bleiben darf: Anschrift im Mail-Fuss, Tourennamen.
const ERLAUBT = /Brucknerstraße 7 · 84489 Burghausen/g;

/** Ersetzt jede Zeile [alt, neu] ueberall; fehlt eine, wirft es (Abbruch statt stiller Luecke). */
export function uebersetzen(html, zeilen, name = 'Quelle') {
  let t = html;
  for (const [alt, neu] of zeilen) {
    if (!t.includes(alt)) throw new Error(`${name}: Zeile trifft nicht mehr — „${alt.slice(0, 80)}“`);
    t = t.split(alt).join(neu);
  }
  return t;
}

// Erzeugte Sprach-Bloecke kommen aus sprachen-bauen.mjs, nicht aus der Quelle.
const ohneSprachBloecke = (h) => h.replace(/\n?[ \t]*<!-- SPRACHE:(\w+) -->[\s\S]*?<!-- \/SPRACHE:\1 -->/g, '');

export function baue(f) {
  const quelle = ohneSprachBloecke(readFileSync(f.quelle, 'utf8'));
  let html = uebersetzen(quelle, f.zeilen, f.quelle);
  // Mails ohne deutsche Kommentare — bis auf die SMASHIE-Marken, die tour-mail.mjs braucht.
  if (f.mail) html = html.replace(/<!--(?! SMASHIE:)[\s\S]*?-->/g, '').replace(/^\s+/, '');
  // Seiten in PAARE tragen den Stempel, gegen welchen DE-Stand sie gebaut sind (sprachen-check).
  if (f.stempel) html = html.replace('</head>', `${stempelZeile(f.stempel, readFileSync(f.quelle, 'utf8'))}\n</head>`);
  return html;
}

/** Deutsche Reste im sichtbaren Text (Mails: auch ohne <head>). */
export function deutscheReste(html) {
  const text = sichtbarerText(html).replace(ERLAUBT, ' ');
  return [...new Set(text.match(DEUTSCH) || [])];
}

function pruefen() {
  const befunde = [];
  for (const f of FLAECHEN) {
    let soll;
    try { soll = baue(f); } catch (e) { befunde.push(e.message); continue; }
    if (!existsSync(f.ziel)) { befunde.push(`${f.ziel} fehlt — node scripts/en-flaechen.mjs`); continue; }
    const ist = ohneSprachBloecke(readFileSync(f.ziel, 'utf8'));
    if (ist !== ohneSprachBloecke(soll)) befunde.push(`${f.ziel} ist veraltet oder von Hand geändert — node scripts/en-flaechen.mjs`);
    const reste = deutscheReste(soll);
    if (reste.length) befunde.push(`${f.ziel}: deutsche Wörter (${reste.join(', ')})`);
  }
  return befunde;
}

function selbsttest() {
  const faelle = [];
  let rot = '';
  try { uebersetzen('<p>Hallo</p>', [['<p>Tschüss</p>', 'x']], 'Fixture'); } catch (e) { rot = e.message; }
  faelle.push(['fehlende Zeile bricht ab', /trifft nicht mehr/.test(rot), true]);
  faelle.push(['Zeile ersetzt jedes Vorkommen', uebersetzen('<a>Start</a><a>Start</a>', [['<a>Start</a>', '<a>Home</a>']]), '<a>Home</a><a>Home</a>']);
  faelle.push(['Deutsch wird gesehen', deutscheReste('<p>Trag dich ein und hol dir den Starter</p>').length > 0, true]);
  faelle.push(['Englisch ist sauber', deutscheReste('<p>Sign up and get the starter</p>').length, 0]);
  faelle.push(['Anschrift im Fuss ist erlaubt', deutscheReste('<p>Sebastian Wimmer · Brucknerstraße 7 · 84489 Burghausen</p>').length, 0]);
  let n = 0;
  for (const [name, ist, soll] of faelle) {
    const ok = ist === soll;
    if (!ok) n++;
    console.log(`${ok ? '🟢' : '🔴'} ${name}${ok ? '' : ` — ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`}`);
  }
  return n;
}

const arg = process.argv.slice(2);
if (arg.includes('--selbsttest')) process.exit(selbsttest() ? 1 : 0);
else if (arg.includes('--pruefen')) {
  const b = pruefen();
  for (const x of b) console.error('🔴 ' + x);
  if (b.length) process.exit(1);
  console.log(`🟢 EN-Flächen: ${FLAECHEN.length} Dateien aktuell, kein Deutsch`);
} else {
  for (const f of FLAECHEN) {
    const neu = baue(f);
    // Sprach-Bloecke einer schon gebauten Datei bleiben bis zum naechsten sprachen-bauen stehen.
    const alt = existsSync(f.ziel) ? readFileSync(f.ziel, 'utf8') : '';
    if (ohneSprachBloecke(alt) === ohneSprachBloecke(neu)) continue;
    mkdirSync(dirname(f.ziel), { recursive: true });
    writeFileSync(f.ziel, neu);
    console.log(`geschrieben: ${f.ziel}`);
  }
}
