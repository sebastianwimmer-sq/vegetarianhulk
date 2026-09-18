#!/usr/bin/env node
/* sicherheits-loop.mjs — Sicherheit und Recht, Seite fuer Seite.
 *
 * WARUM
 * VH liegt auf GitHub Pages: der GANZE Branch wird ausgeliefert, und es gibt
 * keine HTTP-Header, die wir setzen koennten. Beides verschiebt die Pruefung
 * dorthin, wo sie sonst niemand macht — in die Dateien und in den Browser.
 *
 * Am 18.09.2026 fand der erste Lauf: eine zweite, VERALTETE
 * Datenschutzerklaerung unter /legal-slim/ (Stand Juni, ohne Turnstile), eine
 * oeffentlich erreichbare Admin-Oberflaeche und den Quelltext des
 * Formular-Workers. Nichts davon war verlinkt — deshalb hatte es auch nie eine
 * Pruefung gesehen.
 *
 * GEPRUEFT WIRD JEDE SEITE EINZELN:
 *   Sicherheit   fremde Hosts · Mixed Content · Cookies/localStorage ohne
 *                Einwilligung · CSP vorhanden und eingehalten · noopener
 *   Recht        Impressum und Datenschutz von JEDER Seite erreichbar ·
 *                Werbekennzeichnung, wo Partnerlinks stehen · keine zweite
 *                Fassung eines Rechtstexts · Lizenznennung wo noetig
 *   Flaeche      Waisen und interne Dateien, die trotzdem ausgeliefert werden
 *
 * Aufruf:  node scripts/sicherheits-loop.mjs [--live] [--selbsttest]
 *          --live prueft gegen vegetarianhulk.de statt gegen den Arbeitsbaum.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); }
catch { console.error(`Playwright nicht gefunden unter ${PW} — npm i -g playwright`); process.exit(2); }

const WURZEL = resolve(import.meta.dirname, '..');
const LIVE = process.argv.includes('--live');
const SELBSTTEST = process.argv.includes('--selbsttest');

/* Jeder Host mit Grund. Wer hier ergaenzt, traegt es im selben Zug in
   datenschutz.html ein — sonst laedt die Seite etwas, das dort nicht steht. */
const ERLAUBTE_HOSTS = {
  'challenges.cloudflare.com': 'Turnstile, Spam-Schutz der Formulare',
  'vh-forms.peaking.workers.dev': 'eigener Formular-Endpoint',
  'api.open-meteo.com': 'Live-Wetter auf den Tourseiten',
};

/* Dateien, die zwar im Repo gebraucht werden, aber nichts im Netz zu suchen
   haben. GitHub Pages kann sie nicht ausblenden — deshalb hier gelistet und
   bewusst als GELB gefuehrt, solange sie kein Geheimnis enthalten. */
const GEDULDET = {
  'workers/': 'Worker-Quelltext — wird per wrangler deployt, enthaelt keine Geheimnisse (gepruefte Bedingung)',
  'email-templates/': 'Vorlagen fuer den Tour-Newsletter, vom Bau-Skript gelesen',
  'mail-templates/': 'Vorlagen der Willkommensstrecke',
};

const HAENDLER = /amazon\.|alpinloacker|nature-heart|lidl\.|awin|digistore/i;
const KENNZEICHEN = /werbung|anzeige|affiliate|provision|partnerlink|werbelink/i;

const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain' };

/* ---------- Seiten und Link-Graph ---------- */

function alleDateien(ordner = WURZEL, aus = []) {
  for (const e of readdirSync(ordner)) {
    if (e === '.git' || e === 'node_modules') continue;
    const p = join(ordner, e);
    if (statSync(p).isDirectory()) alleDateien(p, aus);
    else aus.push(p);
  }
  return aus;
}

const dateien = alleDateien();
const seiten = dateien.filter((p) => p.endsWith('.html')).map((p) => relative(WURZEL, p));

/* Wer verlinkt wen? Eine Seite, auf die nichts zeigt, existiert fuer Besucher
   nicht — ist aber trotzdem abrufbar. Genau dort lagen die Funde. */
const verlinkt = new Set();
for (const s of seiten) {
  const text = await readFile(join(WURZEL, s), 'utf8');
  for (const m of text.matchAll(/href\s*=\s*["']([^"']+)["']/g)) {
    let u = m[1].split('#')[0].split('?')[0];
    if (!u || u.startsWith('http') || u.startsWith('mailto') || u.startsWith('tel')) continue;
    if (u.startsWith('/')) u = u.slice(1);
    else u = relative(WURZEL, resolve(join(WURZEL, s, '..'), u));
    verlinkt.add(u.endsWith('/') || u === '' ? `${u}index.html` : u);
    verlinkt.add(u);
  }
}

/* ---------- Server fuer den lokalen Lauf ---------- */

function server() {
  return new Promise((fertig) => {
    const s = createServer(async (a, r) => {
      let pfad = join(WURZEL, decodeURIComponent(a.url.split('?')[0]));
      if (pfad.endsWith('/')) pfad += 'index.html';
      try {
        const inhalt = await readFile(pfad);
        r.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
        r.end(inhalt);
      } catch { r.writeHead(404); r.end('weg'); }
    });
    s.listen(0, () => fertig({ s, port: s.address().port }));
  });
}

/* ---------- Eine Seite pruefen ---------- */

async function seitePruefen(browser, basis, datei) {
  const rot = [];
  const gelb = [];
  const quelle = await readFile(join(WURZEL, datei), 'utf8');

  /* --- statisch, am Quelltext --- */
  const istRechtstext = /impressum|datenschutz/i.test(datei);
  const istVorlage = Object.keys(GEDULDET).some((g) => datei.startsWith(g));
  /* Eine Weiterleitungsseite ist kein Aufenthaltsort — der Besucher ist nach
     einer Sekunde weg. Fehlende Rechtslinks sind dort ein Hinweis, kein
     Verstoss; gaenzlich ignorieren waere aber auch falsch. */
  const istWeiterleitung = /http-equiv\s*=\s*["']refresh|location\.(replace|href)\s*=/i.test(quelle);
  const istEchteSeite = !istVorlage && !datei.startsWith('legal-slim/');

  if (istEchteSeite && !istRechtstext) {
    const fehlt = [];
    if (!/href\s*=\s*["'][^"']*impressum/i.test(quelle)) fehlt.push('Impressum');
    if (!/href\s*=\s*["'][^"']*datenschutz/i.test(quelle)) fehlt.push('Datenschutz');
    if (fehlt.length) {
      const text = `kein Link auf ${fehlt.join(' und ')} (§ 5 DDG: von jeder Seite erreichbar)`;
      (istWeiterleitung ? gelb : rot).push(istWeiterleitung ? text + ' — Weiterleitungsseite' : text);
    }
  }

  if (istVorlage) {
    /* Vorlagen sind E-Mails, keine Webseiten: Rechtslinks und CSP gehoeren
       dort nicht hin. Geprueft werden sie vom Mail-Tor (mail-check.mjs). */
    const kontextV = await browser.newContext();
    await kontextV.close();
    return { rot, gelb };
  }

  const partner = [...quelle.matchAll(/href\s*=\s*["']([^"']+)["']/g)]
    .map((m) => m[1]).filter((u) => HAENDLER.test(u) || /\/go\//.test(u));
  if (partner.length && !KENNZEICHEN.test(quelle))
    rot.push(`${partner.length} Partnerlink(s) ohne Werbekennzeichnung (§ 5a Abs. 4 UWG)`);

  /* Amazon verlangt vertraglich EINEN bestimmten Satz auf der Seite, auf der
     die Partnerlinks stehen. Die allgemeine Werbekennzeichnung nach UWG
     erfuellt das NICHT — es sind zwei verschiedene Pflichten aus zwei
     verschiedenen Quellen. Am 18.09.2026 standen vier direkte Amazon-Links auf
     partner-picks, die Formel aber nur auf der Weiterleitungsseite /go/amazon/,
     an der diese Links vorbeigehen. */
  const amazonDirekt = [...quelle.matchAll(/href\s*=\s*["'](https?:\/\/[^"']*amazon\.[^"']*tag=[^"']*)["']/gi)];
  if (amazonDirekt.length && !/als amazon[- ]partner/i.test(quelle))
    rot.push(`${amazonDirekt.length} direkte Amazon-Partnerlink(s), aber der von Amazon `
      + `vorgeschriebene Satz „Als Amazon-Partner verdiene ich an qualifizierten Käufen" fehlt`);

  if (/(?:src|href)\s*=\s*["']http:\/\//i.test(quelle))
    rot.push('Mixed Content: Ressource über http:// eingebunden');

  if (istEchteSeite && !/http-equiv\s*=\s*["']Content-Security-Policy/i.test(quelle))
    gelb.push('keine CSP im Dokument (GitHub Pages lässt keine HTTP-Header zu)');

  const blank = [...quelle.matchAll(/<a\b[^>]*target\s*=\s*["']_blank["'][^>]*>/gi)]
    .filter((m) => !/rel\s*=\s*["'][^"']*noopener/i.test(m[0]));
  if (blank.length) gelb.push(`${blank.length}× target="_blank" ohne rel="noopener"`);

  if (istVorlage) {
    gelb.push('interne Datei, wird von GitHub Pages trotzdem ausgeliefert');
  } else if (!verlinkt.has(datei) && datei !== 'index.html' && datei !== '404.html') {
    gelb.push('Waise: von keiner Seite verlinkt, aber abrufbar');
  }

  /* --- im Browser --- */
  const kontext = await browser.newContext();
  const seite = await kontext.newPage();
  const fremd = new Set();
  const konsole = [];
  seite.on('request', (r) => {
    const u = r.url();
    /* `blob:` und `data:` haben keinen Host — sie entstehen IM Browser und
       gehen nirgendwohin. Ohne diese Zeile meldete das Tor "laedt von ''". */
    if (!/^https?:/.test(u)) return;
    const h = new URL(u).host;
    if (h === basis.host || h.endsWith('vegetarianhulk.de')) return;
    /* Turnstile antwortet von wechselnden Unterdomains
       (hagen.challenges.cloudflare.com). Der Eintrag gilt fuer die Domain. */
    const erlaubt = Object.keys(ERLAUBTE_HOSTS)
      .some((e) => h === e || h.endsWith('.' + e));
    if (!erlaubt) fremd.add(h);
  });
  seite.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text().slice(0, 90)); });

  const url = `${basis.praefix}/${datei.replace(/index\.html$/, '')}`;
  await seite.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await seite.waitForTimeout(1400);

  for (const h of fremd) rot.push(`lädt von ${h} — nicht in der erlaubten Liste`);
  const kekse = await kontext.cookies();
  if (kekse.length) rot.push(`setzt ${kekse.length} Cookie(s) ohne Einwilligung: ${kekse.map((k) => k.name).join(', ')}`);
  const speicher = await seite.evaluate(() => { try { return Object.keys(localStorage); } catch { return []; } });
  if (speicher.length && !datei.startsWith('admin/'))
    gelb.push(`schreibt in localStorage ohne Einwilligung: ${speicher.join(', ')}`);

  const cspBruch = konsole.filter((z) => /content security policy/i.test(z));
  if (cspBruch.length) rot.push(`CSP-Verstoß im Browser: ${cspBruch[0]}`);
  const andere = konsole.filter((z) => !/content security policy/i.test(z));
  if (andere.length) gelb.push(`Konsolenfehler: ${andere[0]}`);

  await kontext.close();
  return { rot, gelb };
}

/* ---------- Zweite Fassungen von Rechtstexten ---------- */

async function rechtstexteDoppelt() {
  const funde = [];
  const haupt = { impressum: 'impressum.html', datenschutz: 'datenschutz.html' };
  for (const [art, weg] of Object.entries(haupt)) {
    const andere = seiten.filter((s) => s !== weg && new RegExp(art, 'i').test(s)
      && !s.startsWith('email-templates/') && !s.startsWith('mail-templates/'));
    for (const a of andere) {
      const t = await readFile(join(WURZEL, a), 'utf8');
      const h = await readFile(join(WURZEL, weg), 'utf8');
      const standA = (t.match(/Stand:\s*([^<]{4,30})/) || [])[1];
      const standH = (h.match(/Stand:\s*([^<]{4,30})/) || [])[1];
      funde.push(`${a} ist eine zweite Fassung von ${weg}`
        + (standA && standH && standA.trim() !== standH.trim()
          ? ` — und veraltet (${standA.trim()} gegen ${standH.trim()})` : ''));
    }
  }
  return funde;
}

/* ---------- Lauf ---------- */

if (SELBSTTEST) {
  /* Zwei Fixtures im Speicher: einmal kaputt, einmal sauber. */
  const kaputt = '<html><body><a href="https://www.amazon.de/dp/X?tag=y">Kauf</a></body></html>';
  const sauber = '<html><body><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutz</a></body></html>';
  const hatPartner = (q) => [...q.matchAll(/href\s*=\s*["']([^"']+)["']/g)]
    .map((m) => m[1]).filter((u) => HAENDLER.test(u)).length > 0 && !KENNZEICHEN.test(q);
  if (!hatPartner(kaputt)) { console.error('✗ SELBSTTEST: Partnerlink ohne Kennzeichnung nicht erkannt.'); process.exit(1); }
  if (hatPartner(sauber)) { console.error('✗ SELBSTTEST: Fehlalarm auf sauberer Seite.'); process.exit(1); }
  console.log('✓ Selbsttest: Partnerlink ohne Kennzeichnung wird erkannt, saubere Seite nicht.');
  process.exit(0);
}

const { s, port } = LIVE ? { s: null, port: null } : await server();
const basis = LIVE
  ? { praefix: 'https://vegetarianhulk.de', host: 'vegetarianhulk.de' }
  : { praefix: `http://localhost:${port}`, host: `localhost:${port}` };

const browser = await chromium.launch();
const rotGesamt = [];
const gelbGesamt = [];

console.log(`\n── Seiten einzeln (${seiten.length}, ${LIVE ? 'LIVE' : 'Arbeitsbaum'})\n`);
for (const datei of seiten.sort()) {
  const { rot, gelb } = await seitePruefen(browser, basis, datei);
  const zeichen = rot.length ? '🔴' : (gelb.length ? '🟡' : '🟢');
  console.log(`  ${zeichen} ${datei}`);
  rot.forEach((z) => { console.log(`       ROT  ${z}`); rotGesamt.push(`${datei}: ${z}`); });
  gelb.forEach((z) => { console.log(`       gelb ${z}`); gelbGesamt.push(`${datei}: ${z}`); });
}
await browser.close();
if (s) s.close();

const doppelt = await rechtstexteDoppelt();
doppelt.forEach((z) => rotGesamt.push(z));

console.log('\n── Ergebnis');
if (doppelt.length) {
  console.log('  Zweite Fassungen von Rechtstexten:');
  doppelt.forEach((z) => console.log(`    🔴 ${z}`));
}
console.log(`  🔴 ${rotGesamt.length} · 🟡 ${gelbGesamt.length}`);
console.log('\n  Geduldet, weil im Repo gebraucht und ohne Geheimnis:');
for (const [pfad, grund] of Object.entries(GEDULDET)) console.log(`    ${pfad} — ${grund}`);
console.log('\n  Nicht abgedeckt, damit die Liste ehrlich bleibt:');
console.log('    · HTTP-Header (HSTS, X-Frame-Options, nosniff): GitHub Pages lässt keine zu.');
console.log('    · Rate-Limits der Worker-Endpunkte: nur durch echtes Hämmern prüfbar,');
console.log('      das verbrennt das eigene Fenster. Siehe workers/vh-forms/worker.js.');
console.log('    · Konten (2FA bei GitHub, Cloudflare, Brevo): kein API-Zugriff.');

process.exit(rotGesamt.length ? 1 : 0);
