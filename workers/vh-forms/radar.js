/* vh-forms · Rückmeldung zum Weihnachtsmarkt-Radar. Eigenes Modul ohne Vorlagen-Importe,
   damit die Regeln mit `node --test` prüfbar sind (worker.js importiert .html als Text). */
const MAX_FIELD_LEN = 2000;
const cleanField = (value) => String(value ?? '').trim().slice(0, MAX_FIELD_LEN);
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const spracheVon = (wert) => (wert === 'en' ? 'en' : 'de');

/* --- Weihnachtsmarkt-Radar: Rückmeldung nach der Suche (16.11.2026) ---
   POST /radar/rueckmeldung {gefunden, sterne, grund, text, markt, region, umkreis, sprache, _honey}
   Kommt als Mail an Sebi; gespeichert wird nichts. Keine E-Mail-Adresse, keine volle Postleitzahl:
   die Seite schickt nur die ersten zwei Ziffern (Region). Honeypot verwirft nicht, er markiert –
   ein Autofill im versteckten Feld darf keine echte Meldung still verschlucken. */
const RADAR_GRUENDE = { 'markt-fehlt': 'Ein Markt fehlt', 'termin-falsch': 'Ein Termin stimmt nicht', anderes: 'Etwas anderes' };
const RADAR_UMKREISE = [10, 25, 50, 100];
const RADAR_TEXT_MAX = 1500;
const RADAR_MARKT_MAX = 160;

export function radarFelder(body) {
  const gefunden = body?.gefunden === true;
  const sterne = Number.isInteger(body?.sterne) && body.sterne >= 0 && body.sterne <= 5 ? body.sterne : 0;
  const felder = {
    gefunden,
    sterne: gefunden ? sterne : 0,
    grund: gefunden ? '' : (Object.hasOwn(RADAR_GRUENDE, body?.grund) ? body.grund : 'anderes'),
    text: cleanField(body?.text).slice(0, RADAR_TEXT_MAX),
    markt: cleanField(body?.markt).slice(0, RADAR_MARKT_MAX),
    region: /^\d{2}$/.test(String(body?.region ?? '')) ? String(body.region) : '',
    umkreis: RADAR_UMKREISE.includes(body?.umkreis) ? body.umkreis : 0,
    sprache: spracheVon(body?.sprache),
    spam: Boolean(cleanField(body?._honey)),
  };
  if (!gefunden && !felder.text) return { fehler: 'Bitte schreib kurz dazu, was gefehlt hat.' };
  if (gefunden && !felder.sterne && !felder.text) return { fehler: 'Bitte wähl Sterne oder schreib einen Satz.' };
  return { felder };
}

export function radarMail(f) {
  const titel = f.gefunden ? `gefunden${f.sterne ? `, ${f.sterne} von 5 Sternen` : ''}` : `nicht gefunden: ${RADAR_GRUENDE[f.grund]}`;
  const rows = [
    ['Gefunden', f.gefunden ? 'Ja' : 'Nein'],
    ['Sterne', f.sterne ? `${f.sterne} von 5` : ''],
    ['Grund', f.grund ? RADAR_GRUENDE[f.grund] : ''],
    ['Markt/Ort', f.markt],
    ['Text', f.text],
    ['Region (PLZ-Anfang)', f.region ? `${f.region}…` : ''],
    ['Umkreis', f.umkreis ? `${f.umkreis} km` : ''],
    ['Sprache', f.sprache],
  ].filter(([, v]) => v);
  const trs = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-weight:700;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('');
  return {
    subject: `${f.spam ? '[Spam-Verdacht] ' : ''}Weihnachtsmarkt-Radar: ${titel}`,
    htmlContent: `<h2 style="font-family:Georgia,serif">Rückmeldung zum Weihnachtsmarkt-Radar</h2>
<table style="font-family:system-ui,sans-serif;font-size:14px;border-collapse:collapse">${trs}</table>
<p style="font-size:12px;color:#666">Gesendet über vegetarianhulk.de/weihnachtsmarkt/ (vh-forms Worker)${f.spam ? ' · das versteckte Feld war ausgefüllt' : ''}</p>`,
  };
}

export async function handleRadarRueckmeldung(request, env, origin, { json, isRateLimited, sender, an }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // eigener Zähler: Rückmeldungen und Newsletter-Anmeldungen bremsen sich nicht gegenseitig
  if (isRateLimited(`radar:${ip}`)) return json({ ok: false, error: 'rate limited' }, 429, origin);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400, origin);
  }
  const { felder, fehler } = radarFelder(body);
  if (fehler) return json({ ok: false, error: fehler }, 400, origin);
  if (!env.BREVO_API_KEY) return json({ ok: false, error: 'mail not configured' }, 503, origin);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    body: JSON.stringify({ sender, to: [{ email: an, name: 'Sebastian Wimmer' }], ...radarMail(felder) }),
  });
  if (!res.ok) {
    console.error('vh-forms radar send failed:', res.status);
    return json({ ok: false, error: 'Versand fehlgeschlagen — bitte direkt an info@vegetarianhulk.de schreiben.' }, 502, origin);
  }
  return json({ ok: true }, 200, origin);
}
