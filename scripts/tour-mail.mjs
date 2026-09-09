#!/usr/bin/env node
/**
 * tour-mail.mjs — Ankuendigungs-Mail fuer eine neue Tour ERZEUGEN, nicht tippen.
 *
 *   node scripts/tour-mail.mjs drachenwand
 *   node scripts/tour-mail.mjs drachenwand --pruefen   # nur pruefen, nichts schreiben
 *
 * WARUM ERZEUGT UND NICHT GEPFLEGT
 * Eine Mail, die von Hand aus der Tour-Seite abgeschrieben wird, driftet beim
 * ersten Nachbessern auseinander: die Seite wird korrigiert, die Mail nicht.
 * Deshalb ist `touren/<slug>/index.html` hier die EINZIGE Quelle. Wer die Zahl
 * auf der Seite aendert, aendert sie in der naechsten Mail automatisch mit.
 *
 * WAS RAUSKOMMT
 *   .mail-versand/<slug>.html   fertiges HTML zum Einfuegen in die Brevo-Kampagne
 *   dazu auf der Konsole: Betreff und Vorschautext
 *
 * Der Ordner ist bewusst NICHT im Repo (.gitignore): erzeugte Artefakte gehoeren
 * nicht in die Versionierung, und ein alter Stand daneben waere eine Falle.
 *
 * `{{ contact.VORNAME … }}` und `{{ unsubscribe }}` BLEIBEN stehen — die fuellt
 * Brevo beim Versand. Jeder andere Platzhalter, der uebrig bleibt, ist ein
 * Fehler und bricht den Lauf ab: "Hey {{ NAME }}" darf niemanden erreichen.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const slug = argv.find(a => !a.startsWith('--'));
const nurPruefen = argv.includes('--pruefen');
/* Eine Zeile fuer das Maskottchen - von Sebi, nicht erfunden. Ohne die
   Angabe faellt der Block weg, statt mit Fuellung besetzt zu werden. */
const smashieArg = argv.find(a => a.startsWith('--smashie='));
const smashie = smashieArg ? smashieArg.slice('--smashie='.length).trim() : null;

if (!slug) {
  console.error('Aufruf: node scripts/tour-mail.mjs <slug> [--pruefen]');
  process.exit(2);
}

const seitePfad = join(WURZEL, 'touren', slug, 'index.html');
if (!existsSync(seitePfad)) {
  console.error(`Keine Tour-Seite unter touren/${slug}/index.html`);
  process.exit(2);
}
const seite = readFileSync(seitePfad, 'utf8');

/* HTML-Reste rauswerfen und Entities aufloesen — in der Mail steht Text,
   keine Markup-Fragmente. Reihenfolge zaehlt: erst Tags, dann Entities. */
const text = (s) => (s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
  .replace(/&szlig;/g, 'ß').replace(/&mdash;/g, '—')
  .replace(/\s+/g, ' ')
  .trim();

const greif = (re, was) => {
  const m = seite.match(re);
  if (!m) {
    console.error(`Nicht gefunden auf der Tour-Seite: ${was}`);
    console.error('Die Mail wird aus der Seite erzeugt — fehlt dort etwas, bricht das hier ab,');
    console.error('statt eine halbe Mail zu schreiben.');
    process.exit(1);
  }
  return m[1];
};

const name   = text(greif(/<h1 class="st st2">([\s\S]*?)<\/h1>/, 'Tour-Name (h1)'));
const altRoh = greif(/<p class="tour-alt[^"]*">([\s\S]*?)<\/p>/, 'Höhe/Ort (.tour-alt)');
const hoehe  = text(altRoh.split('<span class="hsep"')[0]);
const region = text(greif(/<p class="tour-crumb[^"]*">([\s\S]*?)<\/p>/, 'Region (.tour-crumb)')
                    .replace(/<a[^>]*>[\s\S]*?<\/a>/, ''));
const datum  = greif(/<span class="tour-badge">Gegangen[\s\S]*?<\/span>\s*(\d{2}\.\d{2}\.)/, 'Datum (.tour-badge)');
const lead   = text(greif(/<p class="tour-lead[^"]*">([\s\S]*?)<\/p>/, 'Aufhänger (.tour-lead)'));
const notizV = text(greif(/<p class="tour-note__body">([\s\S]*?)<\/p>/, 'O-Ton (.tour-note__body)'));
const foto   = greif(/<div class="tour-hero__img"[^>]*>\s*<img src="([^"]+)"/, 'Hero-Foto');

/* Fakten-Strip: Wert + Beschriftung. Die Live-Kacheln (Wetter, Sonnenaufgang)
   tragen kein einfaches <b>Wert</b> und fallen hier von selbst raus. */
const fakten = [...seite.matchAll(/<div class="tour-fakt"><b[^>]*>([^<]*)<\/b><span>([^<]*)<\/span><\/div>/g)]
  .map(m => ({ wert: text(m[1]), label: text(m[2]) }));

const finde = (...worte) => {
  const t = fakten.find(f => worte.some(w => f.label.toLowerCase().includes(w)));
  return t ? t.wert : null;
};
/* Der Höhenmeter-Wert steht als data-count, weil er hochzählt. */
const hm   = (seite.match(/<b data-count="(\d+)">0<\/b><span>Höhenmeter/) || [])[1];
const km   = fakten.find(f => /km/.test(f.label))?.wert;
const zeit = finde('gehzeit');
const grad = finde('skala');

const fehlend = Object.entries({ name, hoehe, region, datum, lead, notizV, foto, hm, km, zeit, grad })
  .filter(([, v]) => !v).map(([k]) => k);
if (fehlend.length) {
  console.error('Aus der Tour-Seite nicht lesbar: ' + fehlend.join(', '));
  process.exit(1);
}

/* Fuer die Mail die ersten zwei Saetze des O-Tons — der ganze Absatz gehoert
   auf die Seite, nicht in die Ankuendigung. Abkuerzungen wie "z. B." brechen
   den Satz nicht, deshalb wird auf Punkt+Leerzeichen+Grossbuchstabe geteilt. */
const saetze = notizV.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
const notiz = saetze.slice(0, 2).join(' ').trim();

const zahl = Number(hm).toLocaleString('de-DE');

/* Ueberschriftgroesse aus dem laengsten Wort des Tournamens.
   Ein Wort bricht nicht um: bei 39px braucht "Drachenwand" allein 277px, und
   die Mail lief auf einem 320px-Telefon um 37px aus dem Rahmen. Ein laengerer
   Name — "Watzmann-Ostwand" — haette es erneut gebrochen, deshalb rechnet das
   Skript statt eine feste Groesse einzutragen.
   0,646 em pro Zeichen ist an Georgia bold gemessen (dem Ersatz, den Mail-
   Clients tatsaechlich nehmen), 240px ist der Platz bei 320px Fensterbreite.
   Nachgeprueft wird es trotzdem: mail-check misst den Ueberlauf im Browser. */
const laengstesWort = Math.max(...name.split(/[\s-]+/).map(w => w.length));
const h1Size = Math.max(22, Math.min(39, Math.floor(240 / (laengstesWort * 0.646))));
const werte = {
  NAME: name, HOEHE: hoehe, REGION: region, DATUM: datum,
  LEAD: lead, NOTIZ: notiz, HM: zahl, KM: km, ZEIT: zeit, GRAD: grad,
  URL: `https://vegetarianhulk.de/touren/${slug}/`,
  FOTO: `https://vegetarianhulk.de${foto}`,
  FOTO_ALT: `${name} — Blick von der Tour`,
  H1_SIZE: String(h1Size),
};

let html = readFileSync(join(WURZEL, 'email-templates/neue-tour.html'), 'utf8');
if (smashie) {
  werte.SMASHIE = smashie;
} else {
  html = html.replace(/[ \t]*<!-- SMASHIE:START[\s\S]*?<!-- SMASHIE:ENDE -->\n?/, '');
}
for (const [k, v] of Object.entries(werte)) html = html.split(`{{ ${k} }}`).join(v);

/* Was jetzt noch an Platzhaltern steht, darf nur von Brevo kommen. */
const ERLAUBT = ['{{ contact.VORNAME | default : "du" }}', '{{ unsubscribe }}'];
let rest = html;
for (const e of ERLAUBT) rest = rest.split(e).join('');
const uebrig = [...new Set(rest.match(/\{\{[^}]{0,60}\}\}/g) || [])];
if (uebrig.length) {
  console.error('🔴 Platzhalter nicht gefüllt: ' + uebrig.join(', '));
  console.error('Abbruch — eine halbe Mail ist schlimmer als keine.');
  process.exit(1);
}

const betreff = `${name} ist online — ${zahl} hm, ${km} km`;
const vorschau = `${lead.slice(0, 110)}${lead.length > 110 ? '…' : ''}`;

console.log(`\n  Tour       ${name} · ${hoehe} · ${region}`);
console.log(`  Gegangen   ${datum}`);
console.log(`  Zahlen     ${zahl} hm · ${km} km · ${zeit} · ${grad}`);
console.log(`  Überschrift ${h1Size}px (längstes Wort: ${laengstesWort} Zeichen)`);
console.log(`  Smashie     ${smashie ? '"' + smashie + '"' : 'weggelassen (--smashie=... setzt eine Zeile)'}`);
console.log(`\n  Betreff       ${betreff}`);
console.log(`  Vorschautext  ${vorschau}`);

if (nurPruefen) { console.log('\n  (--pruefen: nichts geschrieben)'); process.exit(0); }

const ausOrdner = join(WURZEL, '.mail-versand');
mkdirSync(ausOrdner, { recursive: true });
const ausDatei = join(ausOrdner, `${slug}.html`);
writeFileSync(ausDatei, html, 'utf8');
console.log(`\n  Geschrieben   .mail-versand/${slug}.html  (${Math.round(html.length / 1024)} KB)`);
console.log(`  Naechster Schritt: Inhalt in die Brevo-Kampagne einfuegen, Betreff und`);
console.log(`  Vorschautext von oben uebernehmen, an die Newsletter-Liste senden.`);
console.log(`\n  Vorher pruefen:  node scripts/mail-check.mjs .mail-versand/${slug}.html`);
