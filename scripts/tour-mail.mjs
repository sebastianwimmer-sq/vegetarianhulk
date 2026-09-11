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
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const slug = argv.find(a => !a.startsWith('--'));
const nurPruefen = argv.includes('--pruefen');
/* --entwurf legt die Kampagne in Brevo als ENTWURF an. Nicht senden:
   den Knopf drueckt ein Mensch. Eine Mail an die ganze Liste laesst sich
   nicht zurueckholen, und ein Tippfehler erreicht dann alle auf einmal. */
const alsEntwurf = argv.includes('--entwurf');
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

/* Nicht einfach die ersten zwei: der O-Ton stand dann direkt unter dem
   Aufhaenger und sagte dasselbe (gemessen 75% gemeinsame Inhaltswoerter).
   Zwei Saetze dicht untereinander, die sich wiederholen, lassen eine Mail
   duenn wirken — deshalb das Fenster mit der GERINGSTEN Ueberschneidung.
   Bei Gleichstand gewinnt das fruehere, damit die Reihenfolge erhalten bleibt. */
const inhaltswoerter = (x) => new Set(
  x.toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(w => w.length > 4));
const leadWoerter = inhaltswoerter(lead);
let bestes = { text: saetze.slice(0, 2).join(' ').trim(), quote: 101 };
for (let i = 0; i + 1 < Math.max(saetze.length, 2); i++) {
  const kandidat = saetze.slice(i, i + 2).join(' ').trim();
  if (kandidat.length < 40) continue;
  const w = inhaltswoerter(kandidat);
  if (!w.size) continue;
  const gemeinsam = [...w].filter(x => leadWoerter.has(x)).length;
  const quote = Math.round(gemeinsam / w.size * 100);
  if (quote < bestes.quote) bestes = { text: kandidat, quote };
}
const notiz = bestes.text;

const zahl = Number(hm).toLocaleString('de-DE');

/* Ueberschriftgroesse aus dem laengsten Wort des Tournamens.
   Ein Wort bricht nicht um: bei 39px braucht "Drachenwand" allein 277px, und
   die Mail lief auf einem 320px-Telefon um 37px aus dem Rahmen. Ein laengerer
   Name — "Watzmann-Ostwand" — haette es erneut gebrochen, deshalb rechnet das
   Skript statt eine feste Groesse einzutragen.
   0,646 em pro Zeichen ist an Georgia bold gemessen (dem Ersatz, den Mail-
   Clients tatsaechlich nehmen), 240px ist der Platz bei 320px Fensterbreite.
   Nachgeprueft wird es trotzdem: mail-check misst den Ueberlauf im Browser. */
/* ---------- Bibelvers zur Tour ----------
   Nicht zufaellig: die Themen kommen aus dem, was auf der Tour-Seite steht.
   Ein Vers, der zur Kneifelspitze passt (Sonnenaufgang), passt nicht zu
   einem Kondi-Tag. Trifft nichts, greift "standard" — Sebis Anker-Vers.
   Einzelfall ueberschreiben: --vers=<id> */
const versArg = argv.find(a => a.startsWith('--vers='));
const versDatei = JSON.parse(readFileSync(join(WURZEL, 'email-templates/verse.json'), 'utf8'));
const alleVerse = versDatei.verse;

const text_ = `${lead} ${notizV} ${name}`.toLowerCase();
const SIGNALE = [
  [/erste[nrs]?\s+(mal|klettersteig|via ferrata)|zum ersten mal/, 'erstesmal'],
  [/sonnenaufgang|blaue stunde|im dunkeln|vier uhr|4 uhr/,          'sonnenaufgang'],
  [/klettersteig|via ferrata|steil|ausgesetzt|t4|schwindelfrei/,     'klettern'],
  [/aussicht|blick|panorama|gipfelkreuz/,                            'aussicht'],
];
const themen = SIGNALE.filter(([re]) => re.test(text_)).map(([, t]) => t);
/* Viele Hoehenmeter reihen sich VOR "klettern" und "aussicht" ein: bei einem
   Kondi-Tag ist die Ausdauer die Geschichte, nicht der Blick. Ristfeuchthorn
   bekam sonst einen Kletter-Vers, obwohl es ein langer Wandertag war. */
if (Number(hm) >= 900) themen.splice(themen.indexOf('klettern') >= 0 ? themen.indexOf('klettern') : themen.length, 0, 'lang');

let vers;
if (versArg) {
  const id = versArg.slice('--vers='.length);
  vers = alleVerse.find(v => v.id === id);
  if (!vers) { console.error(`Kein Vers mit id "${id}". Vorhanden: ${alleVerse.map(v => v.id).join(', ')}`); process.exit(2); }
} else {
  /* Der erstgenannte Treffer gewinnt — die Signalliste steht nach
     Aussagekraft sortiert, "erstes Mal" schlaegt "lang". */
  for (const th of themen) {
    vers = alleVerse.find(v => v.themen.includes(th));
    if (vers) break;
  }
  vers = vers || alleVerse.find(v => v.themen.includes('standard'));
}

const laengstesWort = Math.max(...name.split(/[\s-]+/).map(w => w.length));
const h1Size = Math.max(22, Math.min(39, Math.floor(240 / (laengstesWort * 0.646))));
const werte = {
  NAME: name, HOEHE: hoehe, REGION: region, DATUM: datum,
  LEAD: lead, NOTIZ: notiz, HM: zahl, KM: km, ZEIT: zeit, GRAD: grad,
  URL: `https://vegetarianhulk.de/touren/${slug}/`,
  FOTO: `https://vegetarianhulk.de${foto}`,
  FOTO_ALT: `${name} — Blick von der Tour`,
  H1_SIZE: String(h1Size),
  VERS_TEXT: vers.text,
  VERS_STELLE: vers.stelle,
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
console.log(`  O-Ton       ${bestes.quote}% Überschneidung mit dem Aufhänger`);
console.log(`  Vers        ${vers.stelle} — ${vers.text.slice(0, 52)}${vers.text.length > 52 ? '…' : ''}`);
console.log(`  (Signale: ${themen.join(', ') || 'keine → standard'})`);
console.log(`  Smashie     ${smashie ? '"' + smashie + '"' : 'weggelassen (--smashie=... setzt eine Zeile)'}`);
console.log(`\n  Betreff       ${betreff}`);
console.log(`  Vorschautext  ${vorschau}`);

if (nurPruefen) { console.log('\n  (--pruefen: nichts geschrieben)'); process.exit(0); }

const ausOrdner = join(WURZEL, '.mail-versand');
mkdirSync(ausOrdner, { recursive: true });
const ausDatei = join(ausOrdner, `${slug}.html`);
writeFileSync(ausDatei, html, 'utf8');
console.log(`\n  Geschrieben   .mail-versand/${slug}.html  (${Math.round(html.length / 1024)} KB)`);
if (!alsEntwurf) {
  console.log(`  Naechster Schritt: Inhalt in die Brevo-Kampagne einfuegen, Betreff und`);
  console.log(`  Vorschautext von oben uebernehmen, an die Newsletter-Liste senden.`);
}
if (!alsEntwurf) {
  console.log(`\n  Vorher pruefen:  node scripts/mail-check.mjs .mail-versand/${slug}.html`);
  console.log(`  Entwurf anlegen: node scripts/tour-mail.mjs ${slug} --entwurf`);
  process.exit(0);
}

/* ---------- Entwurf in Brevo anlegen ---------- */
const KONFIG = join(homedir(), '.config/vh/newsletter.env');
let adminToken = process.env.NL_ADMIN_TOKEN || '';
if (!adminToken) {
  try {
    const zeile = readFileSync(KONFIG, 'utf8').split('\n').find(z => z.startsWith('NL_ADMIN_TOKEN='));
    adminToken = zeile ? zeile.slice('NL_ADMIN_TOKEN='.length).trim() : '';
  } catch {}
}
if (!adminToken) {
  console.error(`\n  Kein Zugangstoken. Erwartet in ${KONFIG} oder als NL_ADMIN_TOKEN.`);
  process.exit(2);
}

const ENDPUNKT = 'https://vh-forms.peaking.workers.dev/newsletter/kampagne';
const antwort = await fetch(ENDPUNKT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
  body: JSON.stringify({ name: `Tour ${name} (${datum})`, subject: betreff, preheader: vorschau, html }),
});
const daten = await antwort.json().catch(() => ({}));
if (!antwort.ok || !daten.ok) {
  console.error(`\n  🔴 Entwurf nicht angelegt (${antwort.status}): ${daten.error || 'unbekannt'}`);
  process.exit(1);
}
console.log(`\n  ✅ Entwurf in Brevo angelegt — Kampagne #${daten.id}`);
console.log(`     ${daten.brevo || '(Brevo-Oberflaeche)'}`);
console.log(`     Gesendet wird NICHT automatisch: pruefen, dann in Brevo abschicken.`);
