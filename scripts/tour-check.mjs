#!/usr/bin/env node
/**
 * tour-check.mjs — prueft eine Hulk-Hike-Tour gegen HUB-WORKFLOW.md,
 * BEVOR sie live geht.
 *
 *   node scripts/tour-check.mjs <slug>      # eine Tour
 *   node scripts/tour-check.mjs --alle      # alle Detailseiten + Hub
 *
 * Warum: Jeder Punkt hier ist ein Fehler, der schon einmal passiert ist
 * oder den die Spec ausdruecklich fordert. Ein Scan nach dem Bau ist
 * billiger als eine Korrekturrunde an einer Seite, die schon indexiert ist.
 *
 * Exit 1 = FEHLER (blockt Auslieferung). HINWEIS blockt nicht — ein Tor,
 * das bei jedem zweiten Fall grundlos rot steht, wird ignoriert.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOUREN = join(WURZEL, 'touren');
const HUB = join(TOUREN, 'index.html');
const MAX_BILD_KB = 400;

const fehler = [];
const hinweise = [];
const meld = (liste, tour, text) => liste.push(`${tour}: ${text}`);

/* ---------- Detailseite ---------- */
function pruefeDetail(slug) {
  const ordner = join(TOUREN, slug);
  const datei = join(ordner, 'index.html');

  // Ordner ist keine Seite: fehlt index.html, greift der Hosting-Fallback.
  if (!existsSync(datei)) {
    meld(fehler, slug, 'touren/' + slug + '/index.html fehlt (Ordner allein ist keine Seite)');
    return;
  }
  const html = readFileSync(datei, 'utf8');
  const url = `https://vegetarianhulk.de/touren/${slug}/`;

  // -- Pflicht-Kopf
  if (!/<title>[^<]{10,}<\/title>/.test(html)) meld(fehler, slug, '<title> fehlt oder ist zu kurz');
  if (!/<meta name="description" content="[^"]{50,}"/.test(html))
    meld(fehler, slug, 'meta description fehlt oder ist zu kurz (<50 Zeichen)');
  if (!html.includes(`<link rel="canonical" href="${url}"`))
    meld(fehler, slug, `canonical fehlt oder zeigt nicht auf ${url}`);
  if (!html.includes('og:image')) meld(fehler, slug, 'og:image fehlt');

  // -- JSON-LD: muss parsebar sein, nicht nur vorhanden
  const bloecke = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const typen = [];
  for (const [, roh] of bloecke) {
    try { typen.push(JSON.parse(roh)['@type']); }
    catch { meld(fehler, slug, 'JSON-LD ist kein gueltiges JSON'); }
  }
  if (!typen.includes('Article')) meld(fehler, slug, 'JSON-LD Article fehlt');
  if (!typen.includes('BreadcrumbList')) meld(fehler, slug, 'JSON-LD BreadcrumbList fehlt');

  // -- Vorlagen-Reste: eine neue Tour, die noch von einer anderen erzaehlt
  for (const fremd of andereSlugs(slug)) {
    if (new RegExp(`/touren/${fremd}/`).test(html))
      meld(fehler, slug, `verweist noch auf die Vorlage /touren/${fremd}/ — Daten nicht vollstaendig getauscht`);
  }

  // -- Bilder: existieren, haben width/height, sind nicht ueberdimensioniert
  const bilder = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  if (!bilder.length) meld(fehler, slug, 'kein <img> — die Vorlage braucht ein Hero-Foto');
  let heroGesehen = false;
  for (const tag of bilder) {
    const src = (tag.match(/src="([^"]+)"/) || [])[1];
    if (!src || !src.startsWith('/touren/')) continue;
    const pfad = join(WURZEL, src);
    if (!existsSync(pfad)) { meld(fehler, slug, `Bild fehlt: ${src}`); continue; }
    if (!/width="\d+"/.test(tag) || !/height="\d+"/.test(tag))
      meld(fehler, slug, `${src}: width/height fehlen (Layout-Shift, CLS)`);
    const kb = Math.round(statSync(pfad).size / 1024);
    if (kb > MAX_BILD_KB) meld(hinweise, slug, `${src} ist ${kb} KB (>${MAX_BILD_KB}) — ueberdimensioniert?`);
    if (tag.includes('fetchpriority="high"')) {
      heroGesehen = true;
      if (tag.includes('loading="lazy"'))
        meld(fehler, slug, `${src}: Hero ist fetchpriority=high UND lazy — widerspruechlich`);
    }
  }
  if (!heroGesehen) meld(fehler, slug, 'kein Hero-Bild mit fetchpriority="high" (LCP)');

  // -- Gipfelhoehe: EINE Zahl, ueberall gleich.
  //    Der H1-Untertitel (.tour-alt) ist die Quelle. Verglichen werden nur Stellen,
  //    die dieselbe Groesse meinen: Open-Meteo-elevation, die Profil-Beschriftung und
  //    das SVG-Label. Eine getrackte "max. Hoehe" ist eine ANDERE Groesse (GPS weicht
  //    von der amtlichen Hoehe ab) und wird bewusst nicht gegengeprueft — sonst stuende
  //    das Tor bei jeder ehrlich beschrifteten Tour rot.
  //    (Ristfeuchthorn trug 1.569 im H1 und "Gipfel 1.567 m" im Profil.)
  const gipfel = (html.match(/<p class="tour-alt[^"]*">([\d.]+)\s*m/) || [])[1]?.replace('.', '');
  const elev = (html.match(/data-hoehe="(\d{3,4})"/) || [])[1];
  if (!elev) meld(hinweise, slug, 'kein Live-Widget (data-hoehe) gefunden');
  if (!gipfel) {
    meld(hinweise, slug, 'keine Gipfelhoehe im H1-Untertitel (.tour-alt) gefunden — nicht gegengeprueft');
  } else {
    const mitPunkt = Number(gipfel).toLocaleString('de-DE');
    if (elev && elev !== gipfel)
      meld(fehler, slug, `data-hoehe=${elev}, H1 sagt ${mitPunkt} m — einer ist falsch`);

    const profilGipfel = (html.match(/Gipfel\s+([\d.]+)\s*m/) || [])[1];
    if (profilGipfel && profilGipfel.replace('.', '') !== gipfel)
      meld(fehler, slug, `Hoehenprofil beschriftet den Gipfel mit ${profilGipfel} m, H1 sagt ${mitPunkt} m`);

    // Die Gipfelmarke liegt als HTML ueber dem Profil (nicht mehr als <text> im SVG)
    const marke = (html.match(/marke--gipfel[\s\S]{0,160}?·\s*([\d.]+)\s*m/) || [])[1];
    if (marke && marke.replace('.', '') !== gipfel)
      meld(fehler, slug, `Gipfelmarke am Profil sagt ${marke} m, H1 sagt ${mitPunkt} m`);
    if (!marke)
      meld(hinweise, slug, 'keine Gipfelmarke am Hoehenprofil gefunden');
  }


  // -- Design-Kodex (docs/design-kodex-v3.md): das gemeinsame Stylesheet MUSS
  //    die Gestaltung tragen. Frueher lag es als ~230-Zeilen-Block in jeder Tour;
  //    dabei drifteten Radien, Gaps und Flaechen gegen den Kodex.
  for (const geteilt of ['/touren/tour.css', '/touren/tour.js']) {
    if (!html.includes(geteilt))
      meld(fehler, slug, `${geteilt} nicht eingebunden — die Tour traegt eigenes Design statt des gemeinsamen`);
  }
  const eigenesCss = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const kodexZeilen = eigenesCss.split('\n').filter(z => !z.trim().startsWith('/*') && !z.trim().startsWith('*'));
  const eigenerBlock = kodexZeilen.join('\n');
  // Regel 4: Radien kommen aus --r-karte / --r-control, nie als Zahl in der Seite
  const eigeneRadien = eigenerBlock.match(/border-radius:\s*\d+px/g);
  if (eigeneRadien)
    meld(fehler, slug, `page-scoped border-radius (${eigeneRadien[0]}) — Kodex Regel 4 kennt nur --r-karte und --r-control`);
  // Regel 1: zwei Flaechen, keine dritte
  if (/background:\s*linear-gradient/.test(eigenerBlock))
    meld(fehler, slug, 'page-scoped Flaechen-Verlauf — Kodex Regel 1 kennt nur .flaeche-wald und .flaeche-papier');
  if (eigenerBlock.split('\n').filter(z => z.trim()).length > 12)
    meld(hinweise, slug, 'mehr als 12 Zeilen eigenes CSS — gehoert das nicht nach touren/tour.css?');

  // -- Rails: statischer Text ohne data-hm wird vom Altimeter nie aktualisiert
  const railsOhne = [...html.matchAll(/<span class="hm"(?![^>]*data-hm)[^>]*>/g)];
  if (railsOhne.length)
    meld(fehler, slug, 'Rail-Hoehenmeter ohne data-hm — v3.js aktualisiert sie nicht, der Wert friert ein');

  // -- Asset-Refs: versioniert UND aktuell. Ein veralteter Hash faellt sonst erst
  //    im aggressiv cachenden Insta-In-App-Browser auf. Gleicher Algorithmus wie
  //    bump-asset-versions.sh: shasum -a 256, erste 8 Zeichen.
  for (const asset of ['v3.css', 'v3.js', 'fonts.css', 'touren/tour.css', 'touren/tour.js']) {
    if (!html.includes(`/${asset}`)) continue;
    const ref = (html.match(new RegExp(`/${asset.replace(/\./g, '\\.')}\\?v=([a-f0-9]{8})`)) || [])[1];
    if (!ref) {
      meld(fehler, slug, `/${asset} ohne ?v=-Hash eingebunden — bump-asset-versions.sh laufen lassen`);
      continue;
    }
    const quelle = join(WURZEL, asset);
    if (!existsSync(quelle)) continue;
    const ist = createHash('sha256').update(readFileSync(quelle)).digest('hex').slice(0, 8);
    if (ist !== ref)
      meld(fehler, slug, `/${asset}?v=${ref} ist veraltet (Datei hat ${ist}) — bump-asset-versions.sh laufen lassen`);
  }
}

/* ---------- Hub-Liste ---------- */
function pruefeHub(slugs) {
  if (!existsSync(HUB)) { meld(fehler, 'hub', 'touren/index.html fehlt'); return; }
  const html = readFileSync(HUB, 'utf8');
  const zeilen = [...html.matchAll(/<li class="tk-row[^"]*"([^>]*)>/g)].map(m => m[1]);

  // Jede gegangene Tour braucht eine Zeile, die auf sie verlinkt
  for (const slug of slugs) {
    if (!html.includes(`/touren/${slug}/`))
      meld(fehler, 'hub', `keine Liste-Zeile verlinkt auf /touren/${slug}/`);
    if (!new RegExp(`"position":\\d+,"name":"[^"]*","url":"https://vegetarianhulk\\.de/touren/${slug}/"`).test(html))
      meld(fehler, 'hub', `/touren/${slug}/ fehlt in der JSON-LD ItemList (SEO/KI-Findbarkeit)`);
  }

  // data-hm statt data-thm: v3.js-Altimeter ueberschreibt [data-hm] beim Scrollen
  for (const attr of zeilen) {
    if (/\bdata-hm\b/.test(attr)) {
      const name = (attr.match(/data-name="([^"]*)"/) || [])[1] || '?';
      meld(fehler, 'hub', `Zeile "${name}" nutzt data-hm — der Altimeter ueberschreibt das. data-thm nutzen.`);
    }
  }

  // Pflicht-Attribute je Zeile
  for (const attr of zeilen) {
    const name = (attr.match(/data-name="([^"]*)"/) || [])[1] || '(ohne data-name)';
    for (const pflicht of ['data-name', 'data-region', 'data-diff', 'data-thm', 'data-date']) {
      if (!new RegExp(`\\b${pflicht}=`).test(attr))
        meld(fehler, 'hub', `Zeile "${name}": ${pflicht} fehlt`);
    }
  }

  // Jeder verwendete Schwierigkeitsgrad braucht einen Filter-Chip, sonst ist die Tour unfilterbar
  const grade = new Set(zeilen.map(a => (a.match(/data-diff="(\d)"/) || [])[1]).filter(Boolean));
  for (const grad of grade) {
    if (!new RegExp(`data-f="diff" data-v="${grad}"`).test(html))
      meld(fehler, 'hub', `data-diff="${grad}" kommt vor, aber es gibt keinen Filter-Chip dafuer`);
  }

  // Zaehler muss zur Liste passen
  const zaehler = (html.match(/<b id="tkCount">(\d+)<\/b>/) || [])[1];
  if (zaehler && Number(zaehler) !== zeilen.length)
    meld(fehler, 'hub', `tkCount sagt ${zaehler}, die Liste hat ${zeilen.length} Zeilen`);

  // Pinned = die neueste gegangene Tour (data-date als YYYYMMDD; Empfehlungen sind negativ)
  const gegangen = zeilen
    .map(a => ({
      datum: Number((a.match(/data-date="(\d{8})"/) || [])[1] || 0),
      name: (a.match(/data-name="([^"]*)"/) || [])[1] || '',
    }))
    .filter(z => z.datum > 0)
    .sort((a, b) => b.datum - a.datum);
  const pin = (html.match(/<a class="tk-pin[^"]*"[^>]*href="\/touren\/([^/]+)\//) || [])[1];
  if (pin && gegangen.length && !gegangen[0].name.includes(pin))
    meld(fehler, 'hub', `Pinned zeigt "${pin}", neueste gegangene Tour ist aber "${gegangen[0].name.split(' ')[0]}"`);
}

/* ---------- Hilfen ---------- */
function alleSlugs() {
  const { readdirSync } = require('node:fs');
  return readdirSync(TOUREN, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'assets')
    .map(e => e.name);
}
function andereSlugs(slug) {
  return alleSlugsCache.filter(s => s !== slug);
}

const argv = process.argv.slice(2);
const { readdirSync } = await import('node:fs');
const alleSlugsCache = readdirSync(TOUREN, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name !== 'assets')
  .map(e => e.name);

const ziele = argv.includes('--alle') || !argv.length ? alleSlugsCache : argv.filter(a => !a.startsWith('--'));
if (!ziele.length) { console.error('Kein Slug angegeben. Nutzung: tour-check.mjs <slug> | --alle'); process.exit(2); }

for (const slug of ziele) pruefeDetail(slug);
pruefeHub(ziele);

const geprueft = ziele.join(', ');
if (hinweise.length) {
  console.log(`\nHINWEIS (blockt nicht):`);
  for (const h of hinweise) console.log('  · ' + h);
}
if (fehler.length) {
  console.log(`\nFEHLER (${fehler.length}) — ${geprueft}:`);
  for (const f of fehler) console.log('  ✗ ' + f);
  console.log('');
  process.exit(1);
}
console.log(`\n✓ tour-check: ${geprueft} — keine Befunde.\n`);
