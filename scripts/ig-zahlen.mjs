#!/usr/bin/env node
/**
 * Instagram-Zahlen der Brands-Seiten aktuell halten (09.11.2026).
 *
 * WARUM
 * Die Kooperations- und Anfrageseite (DE + EN) zeigten seit Juli 2026 dieselben
 * Zahlen als „letzte 30 Tage“ — vier Monate alt, also falsch. Sebi 09.11.:
 * „stats für die brands seite aktuell halten oder im loop?“ → Loop.
 *
 * Jede Zahl steht im HTML mit ihrer Quelle: `data-ig="followers|views|reach|
 * nicht_follower_prozent|reel_views|stand"`. Dieses Skript holt die 30-Tage-Werte
 * aus dem Insights-Dienst (/admin/zahlen-30, nur mit Admin-Schluessel aus dem
 * Schluesselbund — der Schluessel landet nie in einer Datei) und setzt Text und
 * Zaehl-Attribut je Sprache im richtigen Format.
 *
 *   node scripts/ig-zahlen.mjs               holen + schreiben
 *   node scripts/ig-zahlen.mjs --json f.json  Zahlen aus Datei (ohne Netz)
 *   node scripts/ig-zahlen.mjs --pruefen      Tor: Stand hoechstens 45 Tage alt (Exit 1 sonst)
 *   node scripts/ig-zahlen.mjs --selbsttest
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SEITEN = ['kooperationen.html', 'anfrage.html', 'en/brands/index.html', 'en/brand-inquiry/index.html'];
const QUELLE = 'https://peaking-ai-api.peaking.workers.dev/admin/zahlen-30?brand=hulk';
export const MAX_ALTER_TAGE = 45;
const MONATE = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const GANZ = ['followers', 'views', 'reach', 'reel_views'];

/** Wirft, wenn eine Zahl fehlt oder unplausibel ist — oeffentlich steht nie eine geratene Zahl. */
export function pruefeZahlen(z) {
  for (const k of GANZ) if (!Number.isInteger(z[k]) || z[k] <= 0) throw new Error(`${k} ungueltig: ${z[k]}`);
  const p = z.nicht_follower_prozent;
  if (typeof p !== 'number' || p < 0 || p > 100) throw new Error(`nicht_follower_prozent ungueltig: ${p}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(z.bis || '')) throw new Error(`bis ungueltig: ${z.bis}`);
  if (z.reach > z.views) throw new Error(`Reichweite ${z.reach} > Aufrufe ${z.views}`);
  return z;
}

function sprache(html) { return /<html[^>]*\blang="en"/.test(html) ? 'en' : 'de'; }

export function format(wert, art, lang) {
  if (art === 'prozent') return wert.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  return wert.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');
}

export function standText(bis, lang) {
  const [j, m, t] = bis.split('-').map(Number);
  return lang === 'en' ? `as of ${t} ${MONATE.en[m - 1]} ${j}` : `Stand ${t}. ${MONATE.de[m - 1]} ${j}`;
}

/** Setzt alle data-ig-Stellen einer Seite; wirft, wenn eine Stelle keinen Wert hat. */
export function einsetzen(html, z) {
  const lang = sprache(html);
  let treffer = 0;
  const neu = html.replace(/(<[a-z]+\b[^>]*\bdata-ig="(\w+)"[^>]*>)([^<]*)(?=<)/g, (_, tag, k) => {
    treffer++;
    if (k === 'stand') return tag.replace(/ data-ig-bis="[^"]*"/, '').replace(/>$/, ` data-ig-bis="${z.bis}">`) + standText(z.bis, lang);
    if (!(k in z)) throw new Error(`data-ig="${k}" hat keinen Wert`);
    const prozent = k === 'nicht_follower_prozent';
    let t = tag;
    if (prozent) t = t.replace(/data-count-pct="[^"]*"/, `data-count-pct="${z[k]}"`);
    else t = t.replace(/data-count="[^"]*"/, `data-count="${z[k]}"`);
    return t + format(z[k], prozent ? 'prozent' : 'ganz', lang);
  });
  return { html: neu, treffer };
}

/** Tor: jede Seite traegt einen Stand, keiner ist aelter als MAX_ALTER_TAGE. */
export function pruefen(dateien, heute = new Date()) {
  const befunde = [];
  for (const [name, html] of dateien) {
    const staende = [...html.matchAll(/data-ig-bis="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    const hatZahlen = /data-ig="/.test(html);
    if (!hatZahlen) { befunde.push(`${name}: keine data-ig-Zahlen (Markierung verloren?)`); continue; }
    if (/data-ig="stand"/.test(html) && !staende.length) befunde.push(`${name}: Stand ohne Datum — nie aus dem Insights-Dienst gesetzt`);
    for (const s of staende) {
      const tage = Math.floor((heute - new Date(s + 'T00:00:00Z')) / 864e5);
      if (tage > MAX_ALTER_TAGE) befunde.push(`${name}: Zahlen vom ${s}, ${tage} Tage alt (Grenze ${MAX_ALTER_TAGE}) — node scripts/ig-zahlen.mjs`);
    }
  }
  return befunde;
}

function holen() {
  const key = execFileSync('security', ['find-generic-password', '-s', 'peaking-admin-key', '-w'], { encoding: 'utf8' }).trim();
  const out = execFileSync('curl', ['-sf', '--max-time', '60', '-H', `X-Peaking-Key: ${key}`, QUELLE], { encoding: 'utf8' });
  return JSON.parse(out);
}

function selbsttest() {
  const z = { bis: '2026-11-09', followers: 2116, views: 152350, reach: 90849, nicht_follower_prozent: 99.6, reel_views: 117447 };
  const de = '<html lang="de"><span data-ig="followers">2.091</span> <b data-ig="views" data-count="1">1</b> <b data-ig="nicht_follower_prozent" data-count-pct="62.8">62,8%</b> (<span data-ig="stand">Juli 2026</span>)';
  const en = de.replace('lang="de"', 'lang="en"');
  const a = einsetzen(de, z).html, b = einsetzen(en, z).html;
  const soll = [
    [a.includes('>2.116<') && a.includes('data-count="152350">152.350<') && a.includes('data-count-pct="99.6">99,6%<'), 'DE-Format'],
    [b.includes('>2,116<') && b.includes('>152,350<') && b.includes('>99.6%<'), 'EN-Format'],
    [a.includes('data-ig-bis="2026-11-09">Stand 9. November 2026<') && b.includes('>as of 9 November 2026<'), 'Stand je Sprache'],
    [einsetzen(a, { ...z, bis: '2026-12-01' }).html.split('data-ig-bis=').length === 2, 'Stand wird ersetzt, nicht verdoppelt'],
    [pruefen([['x', a]], new Date('2026-11-20')).length === 0, 'frischer Stand gruen'],
    [pruefen([['x', a]], new Date('2027-01-10')).length === 1, 'alter Stand rot'],
    [pruefen([['x', de]], new Date('2026-11-20')).length === 1, 'Stand ohne Datum rot'],
    [pruefen([['x', '<p>nix</p>']]).length === 1, 'Markierung verloren rot'],
  ];
  let kaputt = false;
  try { pruefeZahlen({ ...z, reach: undefined }); kaputt = true; } catch { /* soll werfen */ }
  soll.push([!kaputt, 'fehlende Zahl wirft']);
  const rot = soll.filter(([ok]) => !ok).map(([, n]) => n);
  if (rot.length) { console.error('✗ ig-zahlen Selbsttest:', rot.join(', ')); process.exit(1); }
  console.log(`✓ ig-zahlen Selbsttest: ${soll.length} Faelle`);
}

const arg = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (arg.includes('--selbsttest')) selbsttest();
  else if (arg.includes('--pruefen')) {
    const befunde = pruefen(SEITEN.map((s) => [s, readFileSync(join(WURZEL, s), 'utf8')]));
    if (befunde.length) { befunde.forEach((b) => console.error('✗ ' + b)); process.exit(1); }
    console.log(`✓ ig-zahlen: ${SEITEN.length} Seiten, Stand frisch`);
  } else {
    const i = arg.indexOf('--json');
    const z = pruefeZahlen(i >= 0 ? JSON.parse(readFileSync(arg[i + 1], 'utf8')) : holen());
    for (const s of SEITEN) {
      const p = join(WURZEL, s);
      const { html, treffer } = einsetzen(readFileSync(p, 'utf8'), z);
      if (!treffer) throw new Error(`${s}: keine data-ig-Stelle gefunden`);
      writeFileSync(p, html);
      console.log(`${s}: ${treffer} Zahlen`);
    }
    console.log(`Stand ${z.bis}: ${z.followers} Follower · ${z.views} Aufrufe · ${z.reach} Konten · ${z.nicht_follower_prozent}% Nicht-Follower · ${z.reel_views} Reel-Aufrufe`);
  }
}
