#!/usr/bin/env node
/**
 * Setzt in jede zweisprachige Seite (scripts/sprachen.mjs) zwei erzeugte Bloecke:
 *  - SPRACHE:KOPF     hreflang + og:locale:alternate direkt vor </head>
 *  - SPRACHE:WECHSEL  den Umschalter rechts in der Kopfleiste (.topbar)
 * Fehlt die Schwester noch, werden beide Bloecke entfernt statt ins Leere zu zeigen.
 *
 * Idempotent: ein zweiter Lauf aendert nichts.
 * Aufruf: node scripts/sprachen-bauen.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PAARE, datei, kopfZeilen, umschalter } from './sprachen.mjs';

const block = (name) => new RegExp(`\\n?[ \\t]*<!-- SPRACHE:${name} -->[\\s\\S]*?<!-- /SPRACHE:${name} -->`);

function setze(html, pfad) {
  let t = html.replace(block('KOPF'), '').replace(block('WECHSEL'), '');
  const kopf = kopfZeilen(pfad);
  if (kopf) {
    if (!t.includes('</head>')) throw new Error(`</head> fehlt in ${datei(pfad)}`);
    t = t.replace('</head>', `<!-- SPRACHE:KOPF -->\n${kopf}\n<!-- /SPRACHE:KOPF -->\n</head>`);
  }
  const wechsel = umschalter(pfad);
  if (wechsel) {
    const leiste = t.match(/<header class="topbar"[^>]*>[\s\S]*?\n(\s*)<\/header>/);
    if (!leiste) throw new Error(`Kopfleiste <header class="topbar"> fehlt in ${datei(pfad)}`);
    const einzug = leiste[1] + '  ';
    const neu = leiste[0].replace(/\n(\s*)<\/header>$/, `\n${einzug}<!-- SPRACHE:WECHSEL -->${wechsel}<!-- /SPRACHE:WECHSEL -->\n$1</header>`);
    t = t.replace(leiste[0], neu);
  }
  return t;
}

let n = 0;
for (const pfad of PAARE.flatMap((p) => [p.de, p.en])) {
  if (!existsSync(datei(pfad))) continue;
  const alt = readFileSync(datei(pfad), 'utf8');
  const neu = setze(alt, pfad);
  if (neu !== alt) {
    writeFileSync(datei(pfad), neu);
    console.log(`aktualisiert: ${datei(pfad)}`);
    n++;
  }
}
console.log(`fertig — ${n} Datei(en) geaendert.`);
