/* Tests fuer die Radar-Rueckmeldung:  node --test workers/vh-forms/radar.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { radarFelder, radarMail, handleRadarRueckmeldung } from './radar.js';

const json = (body, status) => new Response(JSON.stringify(body), { status });
const treffer = new Map();
const isRateLimited = (k) => { const n = (treffer.get(k) || 0) + 1; treffer.set(k, n); return n > 5; };
const route = (req, env) => handleRadarRueckmeldung(req, env, 'https://vegetarianhulk.de', { json, isRateLimited, sender: {}, an: 'x@example.org' });

const anfrage = (body, ip = '203.0.113.7') => new Request('https://vh-forms.example/radar/rueckmeldung', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vegetarianhulk.de', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) });

test('Nein ohne Text wird abgelehnt, mit Text angenommen', () => {
  assert.ok(radarFelder({ gefunden: false, text: '  ' }).fehler);
  assert.equal(radarFelder({ gefunden: false, text: 'Markt in Tittmoning fehlt', grund: 'markt-fehlt' }).felder.grund, 'markt-fehlt');
});

test('unbekannter Grund, fremder Umkreis und volle Postleitzahl kommen nicht durch', () => {
  const { felder } = radarFelder({ gefunden: false, text: 'x', grund: '<script>', umkreis: 7, region: '84489' });
  assert.deepEqual([felder.grund, felder.umkreis, felder.region], ['anderes', 0, '']);
});

test('Sterne nur von 0 bis 5 und nur bei Ja', () => {
  assert.equal(radarFelder({ gefunden: true, sterne: 9, text: 'gut' }).felder.sterne, 0);
  assert.equal(radarFelder({ gefunden: true, sterne: 4 }).felder.sterne, 4);
  assert.equal(radarFelder({ gefunden: false, sterne: 4, text: 'x' }).felder.sterne, 0);
  assert.ok(radarFelder({ gefunden: true }).fehler);
});

test('Mail maskiert HTML und markiert das versteckte Feld statt zu verwerfen', () => {
  const { felder } = radarFelder({ gefunden: false, text: '<b>fett</b>', _honey: 'bot' });
  const mail = radarMail(felder);
  assert.ok(mail.subject.startsWith('[Spam-Verdacht] '));
  assert.ok(mail.htmlContent.includes('&lt;b&gt;fett&lt;/b&gt;') && !mail.htmlContent.includes('<b>fett'));
});

test('Route: ohne Mail-Schluessel 503, falscher Inhalt 400, sechste Meldung derselben Adresse 429', async () => {
  assert.equal((await route(anfrage({ gefunden: true, sterne: 5 }), {})).status, 503);
  assert.equal((await route(anfrage({ gefunden: false }), {})).status, 400);
  let letzter = 0;
  for (let i = 0; i < 6; i++) letzter = (await route(anfrage({ gefunden: true, sterne: 5 }, '203.0.113.99'), {})).status;
  assert.equal(letzter, 429);
});
