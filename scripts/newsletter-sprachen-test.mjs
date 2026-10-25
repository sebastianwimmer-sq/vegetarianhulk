#!/usr/bin/env node
/**
 * Newsletter zweisprachig (25.10.2026): der ECHTE Worker (workers/vh-forms/worker.js), gebuendelt,
 * gegen ein nachgestelltes Brevo. Spielt den ganzen Weg je Sprache durch: Anmeldung → Bestaetigungs-
 * Mail → Klick → Liste → Berg-Starter → Danke-Seite. Rot, sobald eine englische Anmeldung auf der
 * deutschen Liste landet, deutsche Mails bekommt oder auf der deutschen Danke-Seite endet.
 *
 *   node scripts/newsletter-sprachen-test.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deutscheReste } from './en-flaechen.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ordner = mkdtempSync(join(tmpdir(), 'vh-nl-'));
const bündel = join(ordner, 'worker.mjs');
execFileSync('npx', ['-y', 'esbuild@0.17.19', join(WURZEL, 'workers/vh-forms/worker.js'), '--bundle', '--format=esm',
  '--loader:.html=text', `--outfile=${bündel}`, '--log-level=error'], { stdio: 'inherit' });
const worker = (await import(pathToFileURL(bündel).href)).default;
rmSync(ordner, { recursive: true, force: true });

// Nachgestelltes Brevo: schreibt jeden Aufruf mit.
let aufrufe = [];
let listen = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  aufrufe.push({ pfad: u.pathname + u.search, methode: init.method || 'GET', body });
  const antwort = (status, daten) => new Response(JSON.stringify(daten), { status });
  if (u.pathname === '/v3/contacts/lists' && (init.method || 'GET') === 'GET') return antwort(200, { lists: listen });
  if (u.pathname === '/v3/contacts/lists/5') return antwort(200, { id: 5, folderId: 7 });
  if (u.pathname === '/v3/contacts/lists') { listen.push({ id: 9, name: body.name }); return antwort(201, { id: 9 }); }
  if (u.pathname === '/v3/emailCampaigns') return antwort(201, { id: 1 });
  return antwort(201, {});
};

const ENV = { BREVO_API_KEY: 'k', NL_LIST_ID: '5', NL_LIST_ID_EN: '9', NL_ADMIN_TOKEN: 'geheim', NL_REDIRECT_URL: 'https://vegetarianhulk.de/danke.html' };
let ip = 0;
const post = (pfad, daten, kopf = {}) => worker.fetch(new Request('https://vh-forms.peaking.workers.dev' + pfad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.' + (++ip), Origin: 'https://vegetarianhulk.de', ...kopf },
  body: JSON.stringify(daten) }), ENV);

async function durchlauf(sprache, env = ENV) {
  aufrufe = [];
  const r = await worker.fetch(new Request('https://vh-forms.peaking.workers.dev/newsletter/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.1.' + (++ip) },
    body: JSON.stringify({ email: `test-${sprache}@example.com`, ...(sprache ? { sprache } : {}) }) }), env);
  const doi = aufrufe.find((a) => a.pfad === '/v3/smtp/email');
  if (r.status !== 200 || !doi) return { status: r.status };
  const link = doi.body.htmlContent.match(/href="(https:\/\/vh-forms[^"]+)"/)[1];
  aufrufe = [];
  const klick = await worker.fetch(new Request(link), env);
  return {
    status: r.status, doi,
    liste: aufrufe.find((a) => a.pfad === '/v3/contacts')?.body.listIds,
    starter: aufrufe.find((a) => a.pfad === '/v3/smtp/email')?.body,
    ziel: klick.headers.get('Location'), link,
  };
}

const faelle = [];
const fall = (name, ist, soll) => faelle.push([name, JSON.stringify(ist), JSON.stringify(soll)]);

const de = await durchlauf(undefined);
fall('DE: Bestätigungs-Mail deutsch', de.doi.body.subject, 'Fast dabei — einmal bestätigen 🏔️');
fall('DE: Liste 5', de.liste, [5]);
fall('DE: Berg-Starter deutsch', de.starter.subject, 'Dein Berg-Starter 🏔️');
fall('DE: Danke-Seite deutsch', de.ziel, 'https://vegetarianhulk.de/danke.html?bestaetigung=ok');
fall('DE: Anrede „du“ gefüllt', /Hey du,/.test(de.doi.body.htmlContent), true);

const en = await durchlauf('en');
fall('EN: Bestätigungs-Mail englisch', en.doi.body.subject, 'Almost there — confirm once 🏔️');
fall('EN: Mail ohne Deutsch', deutscheReste(en.doi.body.htmlContent), []);
fall('EN: Anrede „there“ gefüllt, kein Merge-Tag übrig', /Hey there,/.test(en.doi.body.htmlContent) && !/\{\{/.test(en.doi.body.htmlContent), true);
fall('EN: eigene Liste 9, nie die deutsche', en.liste, [9]);
fall('EN: Hike Starter englisch', en.starter.subject, 'Your Hike Starter 🏔️');
fall('EN: Starter ohne Deutsch', deutscheReste(en.starter.htmlContent), []);
fall('EN: Starter verlinkt die englische Seite', en.starter.htmlContent.includes('https://vegetarianhulk.de/en/hike-starter/'), true);
fall('EN: Danke-Seite englisch', en.ziel, 'https://vegetarianhulk.de/en/thanks/?bestaetigung=ok');

const ohneListe = await durchlauf('en', { ...ENV, NL_LIST_ID_EN: '' });
fall('EN ohne englische Liste → 503, keine Mail (nie auf die deutsche Liste)', [ohneListe.status, ohneListe.doi], [503, undefined]);

// Abgelaufener englischer Link → englische Erklärung.
const echtesNow = Date.now;
Date.now = () => echtesNow() + 8 * 24 * 3600 * 1000;
const alt = await worker.fetch(new Request(en.link), ENV);
Date.now = echtesNow;
fall('EN: abgelaufener Link → /en/thanks/?bestaetigung=abgelaufen', alt.headers.get('Location'), 'https://vegetarianhulk.de/en/thanks/?bestaetigung=abgelaufen');
const kaputt = await worker.fetch(new Request(en.link.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), ENV);
fall('kaputter Link → abgelaufen (deutsch)', kaputt.headers.get('Location'), 'https://vegetarianhulk.de/danke.html?bestaetigung=abgelaufen');

// Liste anlegen: geschützt, im Ordner der deutschen Liste, idempotent.
fall('Liste anlegen ohne Token → 401', (await post('/newsletter/liste-en', {})).status, 401);
aufrufe = [];
const neu = await (await post('/newsletter/liste-en', {}, { Authorization: 'Bearer geheim' })).json();
fall('Liste anlegen → neu, Ordner der deutschen Liste', [neu, aufrufe.find((a) => a.methode === 'POST')?.body], [{ ok: true, id: 9, neu: true }, { name: 'vegetarianhulk-newsletter-en', folderId: 7 }]);
fall('zweiter Aufruf → dieselbe Liste, nichts neu', await (await post('/newsletter/liste-en', {}, { Authorization: 'Bearer geheim' })).json(), { ok: true, id: 9, neu: false });

// Kampagnen-Entwurf je Sprache an die richtige Liste.
for (const [sprache, liste] of [[undefined, 5], ['en', 9]]) {
  aufrufe = [];
  await post('/newsletter/kampagne', { name: 'T', subject: 'S', html: '<p>x</p>', ...(sprache ? { sprache } : {}) }, { Authorization: 'Bearer geheim' });
  fall(`Kampagne ${sprache || 'de'} → Liste ${liste}`, aufrufe.find((a) => a.pfad === '/v3/emailCampaigns')?.body.recipients.listIds, [liste]);
}

let rot = 0;
for (const [name, ist, soll] of faelle) {
  const ok = ist === soll;
  if (!ok) rot++;
  console.log(`${ok ? '🟢' : '🔴'} ${name}${ok ? '' : ` — ist ${ist.slice(0, 160)}, soll ${soll.slice(0, 160)}`}`);
}
console.log(rot ? `🔴 ${rot} von ${faelle.length} rot` : `🟢 Newsletter DE/EN: ${faelle.length} Fälle grün`);
process.exit(rot ? 1 : 0);
