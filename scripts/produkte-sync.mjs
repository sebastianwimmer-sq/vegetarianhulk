#!/usr/bin/env node
/* produkte-sync.mjs — erzeugt den No-JS-Fallback aus den Produktdaten und prueft sie.
 *
 * WARUM
 * Die Produktliste stand an ZWEI Stellen: in `lieblingsprodukte/products.js` und
 * noch einmal handgeschrieben im `<noscript>`-Block von `partner-picks/index.html`.
 * Dort stand sogar der Hinweis „bei Datenaenderung hier syncen" — also eine
 * Aufgabe, die man vergessen kann. Genau so driftet eine Liste: Crawler und
 * Besucher ohne JS sehen dann etwas anderes als alle anderen.
 *
 * Jetzt ist products.js die einzige Quelle; der Block wird daraus erzeugt.
 *
 * GEPRUEFT WIRD AUSSERDEM
 *   · jede url traegt tag=vegetarianhul-21 (ohne Tag = Arbeit ohne Ertrag)
 *   · Pflichtfelder sind da
 *   · welche Produkte noch Sebis O-Ton brauchen (otonOffen)
 *
 * NICHT pruefbar und deshalb hier genannt statt verschwiegen: die KANAL-REGEL
 * aus products.js — was es bei Nature Heart oder Alpin Loacker gibt, wird
 * NIEMALS ueber Amazon verlinkt. Das weiss nur, wer deren Sortiment kennt.
 *
 * Aufruf:  node scripts/produkte-sync.mjs [--pruefen] [--selbsttest]
 *          --pruefen schreibt nichts, meldet nur Abweichungen (fuer das Tor).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WURZEL = resolve(import.meta.dirname, '..');
const DATEN = join(WURZEL, 'lieblingsprodukte/products.js');
const SEITE = join(WURZEL, 'partner-picks/index.html');
const TAG = 'tag=vegetarianhul-21';
const NUR_PRUEFEN = process.argv.includes('--pruefen');
const SELBSTTEST = process.argv.includes('--selbsttest');

function laden(quelltext) {
  return new Function(`${quelltext}; return VH_PRODUCTS;`)();
}

/* Die Filter-Pillen auf /partner-picks tragen die Kurzform. Fehlt sie fuer
   eine Kategorie, steht dort der ganze Satz und die Leiste wird dreizeilig —
   sichtbar nur auf dem Handy, also genau dort, wo niemand nachsieht. */
function kurzformenLaden(quelltext) {
  return new Function(`${quelltext}; return typeof VH_KATEGORIE_KURZ === 'undefined' ? {} : VH_KATEGORIE_KURZ;`)();
}

function escape(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fallbackBauen(produkte) {
  const zeilen = produkte.filter((p) => p.active).map((p) => {
    const satz = p.text ? ` ${escape(p.text)}` : '';
    return `            <li><strong>${escape(p.name)}</strong> — ${escape(p.kategorie)}.`
      + `${satz} <a href="${escape(p.url)}" rel="sponsored nofollow noopener">Auf Amazon</a></li>`;
  });
  return `        <!-- ERZEUGT von scripts/produkte-sync.mjs aus lieblingsprodukte/products.js.\n`
    + `             Nicht von Hand aendern — der naechste Lauf ueberschreibt es. -->\n`
    + `        <noscript>\n`
    + `          <ul style="margin:0;padding-left:1.1em;color:var(--ink,#1a1410);line-height:1.7">\n`
    + `${zeilen.join('\n')}\n`
    + `          </ul>\n`
    + `        </noscript>`;
}

/* ---------- Selbsttest ---------- */
if (SELBSTTEST) {
  const probe = [
    { name: 'A', kategorie: 'K', text: 'T', url: `https://x/?${TAG}`, active: true },
    { name: 'B', kategorie: 'K', text: 'T', url: 'https://x/', active: true },
  ];
  const ohneTag = probe.filter((p) => !p.url.includes(TAG));
  const block = fallbackBauen(probe);
  if (ohneTag.length !== 1) { console.error('✗ SELBSTTEST: fehlendes Tag nicht erkannt.'); process.exit(1); }
  if (!block.includes('<strong>A</strong>') || !block.includes('sponsored nofollow noopener')) {
    console.error('✗ SELBSTTEST: Fallback wird nicht korrekt gebaut.'); process.exit(1);
  }
  if (block.includes('<strong>C</strong>')) { console.error('✗ SELBSTTEST: erfindet Eintraege.'); process.exit(1); }
  const kurzDa = kurzformenLaden('const VH_KATEGORIE_KURZ = { "K": "Kurz" };');
  const kurzWeg = kurzformenLaden('const VH_PRODUCTS = [];');
  if (kurzDa.K !== 'Kurz') { console.error('✗ SELBSTTEST: vorhandene Kurzform nicht gelesen.'); process.exit(1); }
  if (kurzWeg.K) { console.error('✗ SELBSTTEST: fehlende Kurzform wird nicht als Luecke erkannt.'); process.exit(1); }
  console.log('✓ Selbsttest: fehlendes Tag wird erkannt, Fallback wird korrekt gebaut,'
    + ' fehlende Kategorie-Kurzform faellt auf.');
  process.exit(0);
}

/* ---------- Lauf ---------- */
const quelle = readFileSync(DATEN, 'utf8');
const produkte = laden(quelle);
const kurzformen = kurzformenLaden(quelle);
const befunde = [];

for (const k of new Set(produkte.filter((p) => p.active).map((p) => p.kategorie || 'Sonstiges'))) {
  if (!kurzformen[k]) befunde.push(`Kategorie "${k}": keine Kurzform in VH_KATEGORIE_KURZ — die Filter-Pille traegt sonst den ganzen Satz`);
}

for (const p of produkte) {
  for (const feld of ['name', 'kategorie', 'url']) {
    if (!p[feld]) befunde.push(`${p.name || '(ohne Namen)'}: Pflichtfeld "${feld}" fehlt`);
  }
  if (p.url && !p.url.includes(TAG) && !p.url.startsWith('PENDING_'))
    befunde.push(`${p.name}: url ohne ${TAG} — der Link brächte nichts ein`);
  if (p.active && !p.text)
    befunde.push(`${p.name}: aktiv, aber ohne Text — die Karte bliebe leer`);
}

const html = readFileSync(SEITE, 'utf8');
const muster = /[ \t]*<!--[^>]*?(?:Crawler|ERZEUGT)[\s\S]*?<\/noscript>/;
if (!muster.test(html)) {
  console.error('✗ produkte-sync: der No-JS-Block in partner-picks/index.html ist nicht auffindbar.');
  process.exit(1);
}
const neu = html.replace(muster, fallbackBauen(produkte));
const abweichung = neu !== html;

const offen = produkte.filter((p) => p.otonOffen);

if (befunde.length) {
  console.error(`✗ produkte-sync: ${befunde.length} Befund(e):`);
  befunde.forEach((b) => console.error(`    ${b}`));
  process.exit(1);
}

if (NUR_PRUEFEN) {
  if (abweichung) {
    console.error('✗ produkte-sync: der No-JS-Block passt nicht mehr zu products.js.');
    console.error('  `node scripts/produkte-sync.mjs` erzeugt ihn neu.');
    process.exit(1);
  }
  console.log(`✓ produkte-sync: ${produkte.length} Produkte, Fallback deckungsgleich`
    + (offen.length ? `, ${offen.length} warten auf Sebis Satz` : ''));
  process.exit(0);
}

if (abweichung) writeFileSync(SEITE, neu);
console.log(`✓ produkte-sync: ${produkte.filter((p) => p.active).length} aktive Produkte`
  + ` → No-JS-Block ${abweichung ? 'neu erzeugt' : 'war schon deckungsgleich'}.`);
if (offen.length) {
  console.log(`\n  Diese ${offen.length} tragen nur eine sachliche Zeile — Sebis Satz fehlt:`);
  offen.forEach((p) => console.log(`    · ${p.name}${p.active ? '' : '   (noch nicht live)'}`));
}
