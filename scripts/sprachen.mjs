/**
 * Einzige Quelle fuer die Zweisprachigkeit von vegetarianhulk.de (DE/EN, 20.10.2026).
 *
 * Sebi 20.10.2026: die Seite komplett
 * auf Englisch, mit Umschalter, als fester Haken fuer die Zukunft. Echte Seiten
 * unter /en/, keine Uebersetzung im Browser: KI-Crawler und Suchmaschinen klicken
 * keinen Umschalter, sie lesen nur ausgeliefertes HTML.
 *
 * Jede deutsche Besucherseite hat genau eine englische Schwester. Umschalter,
 * hreflang (scripts/sprachen-bauen.mjs), Sitemap (sitemap-bauen.py) und das Tor
 * (scripts/sprachen-check.mjs) lesen diese Liste — nie eine eigene.
 *
 * Nicht in der Liste (bleiben Deutsch): Impressum, Datenschutz (Rechtstexte),
 * 3-tage-reset, links, go/ (Weiterleitungen, noindex).
 * Newsletter zweisprachig seit 25.10.2026: /newsletter/ ist ein Paar; berg-starter und danke
 * haben englische Schwestern (GEFUEHRT), die nur ueber Mail und Anmeldung erreichbar sind —
 * noindex, darum nicht in Sitemap und hreflang. Alle drei erzeugt scripts/en-flaechen.mjs.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

export const DOMAIN = 'https://vegetarianhulk.de';

const TOUREN = ['drachenwand', 'fellhorn', 'hoerndlwand', 'kneifelspitze', 'ristfeuchthorn', 'schwarzensee', 'wendelstein'];

// Pfade als URL, wie im Canonical der Seite.
export const PAARE = [
  { de: '/', en: '/en/' },
  { de: '/kooperationen.html', en: '/en/brands/' },
  { de: '/anfrage.html', en: '/en/brand-inquiry/' },
  { de: '/partner-picks/', en: '/en/partner-picks/' },
  { de: '/touren/', en: '/en/hikes/' },
  { de: '/newsletter/', en: '/en/newsletter/' },
  ...TOUREN.map((t) => ({ de: `/touren/${t}/`, en: `/en/hikes/${t}/` })),
];

// Englische Schwestern ohne eigenen Suchauftritt (noindex): erreichbar per Mail bzw. Bestaetigung.
export const GEFUEHRT = [
  { de: '/berg-starter/', en: '/en/hike-starter/' },
  { de: '/danke.html', en: '/en/thanks/' },
];

/**
 * 1:1-Regel (Sebi 23.10.2026: „immer beides einfach 1/1 gleich“): wohin ein Link einer deutschen
 * Seite auf ihrer englischen Schwester zeigen muss. Externe Ziele, Anker, Rechtstexte, Dateien
 * und go/-Weiterleitungen bleiben gleich; ein deutscher Pfad ohne Schwester ergibt null.
 */
const SCHWESTER = new Map([...PAARE, ...GEFUEHRT].map((p) => [p.de, p.en]));
export function enZiel(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [pfad, rest = ''] = href.split(/(?=[?#])/);
  const schluessel = pfad === '/newsletter' ? '/newsletter/' : pfad;
  if (SCHWESTER.has(schluessel)) return SCHWESTER.get(schluessel) + rest;
  if (/^\/(impressum|datenschutz)\.html$/.test(pfad) || pfad.startsWith('/go/')) return href;
  if (/\.(jpe?g|png|webp|svg|pdf|js|css|woff2|gpx)$/i.test(pfad)) return href;
  return null;
}

/** URL-Pfad → Datei im Repo ('/' → 'index.html', '/anfrage.html' → 'anfrage.html'). */
export const datei = (pfad) => (pfad.endsWith('/') ? `${pfad.slice(1)}index.html` : pfad.slice(1));

/** Sprache und Schwester eines Pfads, oder null, wenn er nicht zweisprachig ist. */
export function schwester(pfad) {
  for (const p of PAARE) {
    if (p.de === pfad) return { sprache: 'de', eigen: p.de, andere: p.en, paar: p };
    if (p.en === pfad) return { sprache: 'en', eigen: p.en, andere: p.de, paar: p };
  }
  return null;
}

/**
 * Sichtbarer Text einer Seite fuer den Aktualitaets-Stempel. Ausgenommen sind
 * Kopf, Skripte, Styles und die erzeugten Sprach-Bloecke — die aendern sich beim
 * Bauen, nicht beim Schreiben.
 */
export function sichtbarerText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<!-- (SPRACHE):(\w+) -->[\s\S]*?<!-- \/\1:\2 -->/g, ' ')
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const textHash = (html) =>
  createHash('sha256').update(sichtbarerText(html)).digest('hex').slice(0, 16);

/** Meta-Zeile, die jede EN-Seite traegt: gegen welchen DE-Stand sie geschrieben ist. */
export const stempelZeile = (dePfad, deHtml) =>
  `<meta name="vh-quelle" content="${dePfad}@${textHash(deHtml)}">`;

export const STEMPEL_MUSTER = /<meta name="vh-quelle" content="([^"@]+)@([0-9a-f]{16})">/;

/**
 * hreflang-Zeilen und og:locale:alternate fuer den Kopf; leer, solange die
 * Schwester fehlt. og:locale selbst steht auf jeder Seite schon von Hand.
 */
export function kopfZeilen(pfad, wurzel = '.') {
  const s = schwester(pfad);
  if (!s || !existsSync(`${wurzel}/${datei(s.andere)}`)) return '';
  const { de, en } = s.paar;
  return [
    `<link rel="alternate" hreflang="de" href="${DOMAIN}${de}">`,
    `<link rel="alternate" hreflang="en" href="${DOMAIN}${en}">`,
    `<link rel="alternate" hreflang="x-default" href="${DOMAIN}${de}">`,
    `<meta property="og:locale:alternate" content="${s.sprache === 'de' ? 'en_US' : 'de_DE'}">`,
  ].join('\n');
}

// Flaggen als Inline-SVG: Flaggen-Emojis zeigt Windows nicht an.
const FLAGGE = {
  de: '<svg class="sprache-flagge" viewBox="0 0 5 3" width="20" height="12" aria-hidden="true" focusable="false"><path fill="#000" d="M0 0h5v1H0z"/><path fill="#D00" d="M0 1h5v1H0z"/><path fill="#FFCE00" d="M0 2h5v1H0z"/></svg>',
  en: '<svg class="sprache-flagge" viewBox="0 0 60 30" width="20" height="12" aria-hidden="true" focusable="false"><path fill="#012169" d="M0 0v30h60V0z"/><path stroke="#fff" stroke-width="6" d="M0 0l60 30m0-30L0 30"/><path stroke="#C8102E" stroke-width="4" d="M0 0l60 30m0-30L0 30"/><path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#C8102E" stroke-width="6" d="M30 0v30M0 15h60"/></svg>',
};

/**
 * Der Umschalter: EIN Link zur Schwester, beschriftet in deren eigener Sprache
 * ("English" auf DE-Seiten, "Deutsch" auf EN-Seiten). Funktioniert ohne JS,
 * Crawler folgen ihm, Tastatur geht.
 */
export function umschalter(pfad, wurzel = '.') {
  const s = schwester(pfad);
  if (!s || !existsSync(`${wurzel}/${datei(s.andere)}`)) return '';
  const ziel = s.sprache === 'de' ? 'en' : 'de';
  const name = ziel === 'en' ? 'English' : 'Deutsch';
  return `<a class="sprache" href="${s.andere}" hreflang="${ziel}" lang="${ziel}" data-sprache="${ziel}">${FLAGGE[ziel]}<span>${name}</span></a>`;
}
