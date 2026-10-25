#!/usr/bin/env node
/**
 * tour-mail.mjs — Ankuendigungs-Mail fuer eine neue Tour ERZEUGEN, nicht tippen.
 *
 *   node scripts/tour-mail.mjs drachenwand
 *   node scripts/tour-mail.mjs drachenwand --pruefen   # nur pruefen, nichts schreiben
 *   node scripts/tour-mail.mjs drachenwand --sprache=en  # englisch: aus en/hikes/<slug>/,
 *        Vorlage neue-tour.en.html, Entwurf an die englische Liste (Newsletter zweisprachig
 *        seit 25.10.2026 — jede Ausgabe gibt es zweimal: ohne und mit --sprache=en)
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
const EN = argv.includes('--sprache=en');
/* --entwurf legt die Kampagne in Brevo als ENTWURF an. Nicht senden:
   den Knopf drueckt ein Mensch. Eine Mail an die ganze Liste laesst sich
   nicht zurueckholen, und ein Tippfehler erreicht dann alle auf einmal. */
const alsEntwurf = argv.includes('--entwurf');
/* --papier baut die helle Fassung. Gmail kippt eine dunkle Mail im Dark
   Mode auf hell; eine helle dunkelt es ab — und das sieht in beiden
   Faellen gewollt aus statt nach Unfall. */
const alsPapier = argv.includes('--papier');
/* Eine Zeile fuer das Maskottchen - von Sebi, nicht erfunden. Ohne die
   Angabe faellt der Block weg, statt mit Fuellung besetzt zu werden. */
const smashieArg = argv.find(a => a.startsWith('--smashie='));
const smashie = smashieArg ? smashieArg.slice('--smashie='.length).trim() : null;

if (!slug) {
  console.error('Aufruf: node scripts/tour-mail.mjs <slug> [--pruefen]');
  process.exit(2);
}

const seiteRel = EN ? `en/hikes/${slug}/index.html` : `touren/${slug}/index.html`;
const seitePfad = join(WURZEL, seiteRel);
if (!existsSync(seitePfad)) {
  console.error(`Keine Tour-Seite unter ${seiteRel}`);
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
  // Anfuehrungen und Striche: sonst stand im Brevo-Vorschautext woertlich
  // "&bdquo;Den Muskelkater…" — das Feld ist Klartext, es dekodiert nichts.
  .replace(/&bdquo;/g, '„').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ndash;/g, '–')
  .replace(/&hellip;/g, '…')
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
const datum  = EN
  ? greif(/<span class="tour-badge">Hiked[\s\S]*?<\/span>\s*([A-Z][a-z]{2} \d{1,2})/, 'Datum (.tour-badge)')
  : greif(/<span class="tour-badge">Gegangen[\s\S]*?<\/span>\s*(\d{2}\.\d{2}\.)/, 'Datum (.tour-badge)');
const lead   = text(greif(/<p class="tour-lead[^"]*">([\s\S]*?)<\/p>/, 'Aufhänger (.tour-lead)'));
const notizV = text(greif(/<p class="tour-note__body">([\s\S]*?)<\/p>/, 'O-Ton (.tour-note__body)'));
// src irgendwo im Tag: seit die Heros srcset VOR src tragen, fand das alte
// Muster (`<img src=` direkt) bei keiner Tour mehr ein Foto.
const foto   = greif(/<div class="tour-hero__img"[^>]*>\s*<img\b[^>]*?\ssrc="([^"]+)"/, 'Hero-Foto');

/* Fakten-Strip: Wert + Beschriftung. Die Live-Kacheln (Wetter, Sonnenaufgang)
   tragen kein einfaches <b>Wert</b> und fallen hier von selbst raus. */
const fakten = [...seite.matchAll(/<div class="tour-fakt"><b[^>]*>([^<]*)<\/b><span>([^<]*)<\/span><\/div>/g)]
  .map(m => ({ wert: text(m[1]), label: text(m[2]) }));

const finde = (...worte) => {
  const t = fakten.find(f => worte.some(w => f.label.toLowerCase().includes(w)));
  return t ? t.wert : null;
};
/* Der Höhenmeter-Wert steht als data-count (die sichtbare Zahl ist formatiert). */
const hm   = (seite.match(EN ? /<b data-count="(\d+)">[^<]*<\/b><span>elevation gain/ : /<b data-count="(\d+)">[^<]*<\/b><span>Höhenmeter/) || [])[1];
const km   = fakten.find(f => /km/.test(f.label))?.wert;
/* Erkannt an der AUSSAGE, nicht am Wortlaut: seit der Hoerndlwand heisst die
   Zeit "in Bewegung" und der Grad steht ohne "SAC-Skala" — die Mail brach fuer
   jede neue Tour ab, ohne dass es jemand merkte. */
const zeit = finde('gehzeit', 'bewegung', 'moving', 'walking');
const grad = finde('skala', 'scale') || fakten.find(f => /^(T[1-6]|[A-F])(\s*[–-]\s*(T[1-6]|[A-F]))?$/.test(f.wert))?.wert;

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

const zahl = Number(hm).toLocaleString(EN ? 'en-US' : 'de-DE');

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

/* Die Signale liest immer die DEUTSCHE Seite — so bekommen beide Sprachen denselben Vers
   (1:1); englische Woerter trafen anders (Ristfeuchthorn: Jesaja deutsch, Psalm englisch). */
const signalSeite = EN ? readFileSync(join(WURZEL, 'touren', slug, 'index.html'), 'utf8') : seite;
const aus = (re) => text((signalSeite.match(re) || [])[1] || '');
const text_ = EN
  ? `${aus(/<p class="tour-lead[^"]*">([\s\S]*?)<\/p>/)} ${aus(/<p class="tour-note__body">([\s\S]*?)<\/p>/)} ${name}`.toLowerCase()
  : `${lead} ${notizV} ${name}`.toLowerCase();
const SIGNALE = [
  [/erste[nrs]?\s+(mal|klettersteig|via ferrata)|zum ersten mal|first (time|via ferrata)/, 'erstesmal'],
  [/sonnenaufgang|blaue stunde|im dunkeln|vier uhr|4 uhr|sunrise|blue hour|in the dark|at 4\b/, 'sonnenaufgang'],
  [/klettersteig|via ferrata|steil|ausgesetzt|t4|schwindelfrei|steep|exposed/, 'klettern'],
  [/aussicht|blick|panorama|gipfelkreuz|view|summit cross/,          'aussicht'],
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
// Englisch: King James Version (gemeinfrei) aus verse.json (text_en, stelle_en).
const versText = EN ? vers.text_en : vers.text;
const versStelle = EN ? vers.stelle_en : vers.stelle;
if (!versText || !versStelle) { console.error(`Vers ${vers.id}: Fassung ${EN ? 'text_en/stelle_en' : 'text/stelle'} fehlt in verse.json`); process.exit(1); }
const werte = {
  NAME: name, HOEHE: hoehe, REGION: region, DATUM: datum,
  LEAD: lead, NOTIZ: notiz, HM: zahl, KM: km, ZEIT: zeit, GRAD: grad,
  URL: EN ? `https://vegetarianhulk.de/en/hikes/${slug}/` : `https://vegetarianhulk.de/touren/${slug}/`,
  FOTO: `https://vegetarianhulk.de${foto}`,
  FOTO_ALT: EN ? `${name} — view from the hike` : `${name} — Blick von der Tour`,
  H1_SIZE: String(h1Size),
  // Versteckter Vorschautext im Postfach = derselbe wie in Brevo (bis 25.10. stand dort der
  // Satz der Willkommens-Mail: „Deine 3 Touren zum Reinkommen …“).
  VORSCHAU: `${lead.slice(0, 110)}${lead.length > 110 ? '…' : ''}`,
  VERS_TEXT: versText,
  VERS_STELLE: versStelle,
};

/* ---------- Farben aus der Quelle einsetzen ----------
   E-Mail kann keine CSS-Variablen — die Werte MUESSEN als Literal in der
   Mail stehen. Getippt driften sie: am 11.09.2026 standen 25 von 27
   Mail-Farben in keinem Token der Website, darunter #f5eedd neben
   --card-cream: #f5eede. Also Literal ja, aber eingesetzt statt getippt. */
const farbJson = JSON.parse(readFileSync(join(WURZEL, 'email-templates/farben.json'), 'utf8'));
const farbDatei = alsPapier ? farbJson.farben_papier : farbJson.farben;
if (!farbDatei) { console.error('Palette fehlt in farben.json'); process.exit(1); }
const siteCss = readFileSync(join(WURZEL, 'v3.css'), 'utf8');
const siteTokens = Object.fromEntries(
  [...siteCss.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2].toUpperCase()]));

const farben = {};
for (const [name, d] of Object.entries(farbDatei)) {
  if (d.aus_site) {
    const v = siteTokens[d.aus_site];
    if (!v) {
      console.error(`🔴 Token --${d.aus_site} steht nicht mehr in v3.css (Rolle "${name}").`);
      console.error('Abbruch: die Mail wuerde sonst mit einer Luecke rausgehen.');
      process.exit(1);
    }
    farben[name] = v;
  } else {
    farben[name] = d.wert.toUpperCase();
  }
}

let html = readFileSync(join(WURZEL, EN ? 'email-templates/neue-tour.en.html' : 'email-templates/neue-tour.html'), 'utf8');
if (smashie) {
  werte.SMASHIE = smashie;
} else {
  html = html.replace(/[ \t]*<!-- SMASHIE:START[\s\S]*?<!-- SMASHIE:ENDE -->\n?/, '');
}
for (const [k, v] of Object.entries(werte)) html = html.split(`{{ ${k} }}`).join(v);
for (const [k, v] of Object.entries(farben)) html = html.split(`{{ FARBE_${k} }}`).join(v);

/* Was jetzt noch an Platzhaltern steht, darf nur von Brevo kommen. */
const ERLAUBT = [`{{ contact.VORNAME | default : "${EN ? 'there' : 'du'}" }}`, '{{ unsubscribe }}'];
let rest = html;
for (const e of ERLAUBT) rest = rest.split(e).join('');
const uebrig = [...new Set(rest.match(/\{\{[^}]{0,60}\}\}/g) || [])];
if (uebrig.length) {
  console.error('🔴 Platzhalter nicht gefüllt: ' + uebrig.join(', '));
  console.error('Abbruch — eine halbe Mail ist schlimmer als keine.');
  process.exit(1);
}

const betreff = EN ? `${name} is online — ${zahl} m elevation gain, ${km} km` : `${name} ist online — ${zahl} hm, ${km} km`;
const vorschau = `${lead.slice(0, 110)}${lead.length > 110 ? '…' : ''}`;

console.log(`\n  Tour       ${name} · ${hoehe} · ${region}`);
console.log(`  Gegangen   ${datum}`);
console.log(`  Zahlen     ${zahl} hm · ${km} km · ${zeit} · ${grad}`);
console.log(`  Überschrift ${h1Size}px (längstes Wort: ${laengstesWort} Zeichen)`);
console.log(`  Palette     ${alsPapier ? 'Papier (hell)' : 'Wald (dunkel)'}`);
console.log(`  Farben      ${Object.keys(farben).length} Rollen, davon ${Object.values(farbDatei).filter(d => d.aus_site).length} aus v3.css`);
console.log(`  O-Ton       ${bestes.quote}% Überschneidung mit dem Aufhänger`);
console.log(`  Sprache     ${EN ? 'Englisch → englische Liste' : 'Deutsch → deutsche Liste'}`);
console.log(`  Vers        ${versStelle} — ${versText.slice(0, 52)}${versText.length > 52 ? '…' : ''}`);
console.log(`  (Signale: ${themen.join(', ') || 'keine → standard'})`);
console.log(`  Smashie     ${smashie ? '"' + smashie + '"' : 'weggelassen (--smashie=... setzt eine Zeile)'}`);
console.log(`\n  Betreff       ${betreff}`);
console.log(`  Vorschautext  ${vorschau}`);

if (nurPruefen) { console.log('\n  (--pruefen: nichts geschrieben)'); process.exit(0); }

const ausOrdner = join(WURZEL, '.mail-versand');
mkdirSync(ausOrdner, { recursive: true });
const ausName = `${slug}${EN ? '.en' : ''}.html`;
const ausDatei = join(ausOrdner, ausName);
writeFileSync(ausDatei, html, 'utf8');
console.log(`\n  Geschrieben   .mail-versand/${ausName}  (${Math.round(html.length / 1024)} KB)`);
if (!alsEntwurf) {
  console.log(`  Naechster Schritt: Inhalt in die Brevo-Kampagne einfuegen, Betreff und`);
  console.log(`  Vorschautext von oben uebernehmen, an die Newsletter-Liste senden.`);
}
if (!alsEntwurf) {
  console.log(`\n  Vorher pruefen:  node scripts/mail-check.mjs .mail-versand/${ausName}`);
  console.log(`  Entwurf anlegen: node scripts/tour-mail.mjs ${slug} --entwurf${EN ? ' --sprache=en' : ''}`);
  if (!EN) console.log(`  Englisch dazu:   node scripts/tour-mail.mjs ${slug} --sprache=en   (jede Ausgabe zweimal)`);
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
  body: JSON.stringify({ name: `Tour ${name} (${datum})${EN ? ' EN' : ''}`, subject: betreff, preheader: vorschau, html, sprache: EN ? 'en' : 'de' }),
});
const daten = await antwort.json().catch(() => ({}));
if (!antwort.ok || !daten.ok) {
  console.error(`\n  🔴 Entwurf nicht angelegt (${antwort.status}): ${daten.error || 'unbekannt'}`);
  process.exit(1);
}
console.log(`\n  ✅ Entwurf in Brevo angelegt — Kampagne #${daten.id}`);
console.log(`     ${daten.brevo || '(Brevo-Oberflaeche)'}`);
console.log(`     Gesendet wird NICHT automatisch: pruefen, dann in Brevo abschicken.`);
