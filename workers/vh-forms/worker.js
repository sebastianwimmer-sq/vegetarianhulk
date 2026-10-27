/* ============================================================
   vh-forms — Formular-Endpoints für vegetarianhulk.de
   POST /brand-inquiry        →  Mail via Brevo Transactional API
                                 an info@vegetarianhulk.de
   POST /newsletter/subscribe →  eigenes Double-Opt-In: signierter Link (HMAC)
                                 + Bestätigungs-Mail via Brevo Transactional
   GET  /newsletter/confirm    →  Link-Klick: Signatur prüfen → Kontakt in
                                 Liste → Redirect zur Website
   Sprache: body.sprache 'en' → eigene Liste NL_LIST_ID_EN, englische Mails,
            /en/thanks/ (25.10.2026); alles andere bleibt deutsch.

   Schutz: Honeypot (_honey) + best-effort Rate-Limit pro IP
   (in-memory pro Isolate — bewusst ohne KV, reicht gegen simple Bots).
   Ohne BREVO_API_KEY-Secret antwortet der Worker 503 — das Frontend
   fällt dann auf den mailto-Flow zurück.
   Newsletter-Config in wrangler.toml [vars]:
     NL_LIST_ID          Brevo-Listen-ID (z.B. 5)
     NL_DOI_TEMPLATE_ID  ID der DOI-Vorlage („VH DOI Bestätigung")
     NL_REDIRECT_URL     Ziel nach Bestätigungs-Klick
   ============================================================ */

// Bestätigungs-Mail-Design (Quelle: email-templates/confirm-doi.html — bei Änderung neu rüberkopieren)
import DOI_HTML from '../../email-templates/confirm-doi.html';
/* Beide Vorlagen kommen direkt aus email-templates/, nicht aus einer Kopie
   im Worker-Ordner. Die Kopie musste bisher bei jeder Änderung von Hand
   herübergeschoben werden — und am 03.09. hatte genau sie die Dark-Mode-
   Korrektur nicht, weil das Prüfwerkzeug nur email-templates/ ansieht. */
import WELCOME_HTML from '../../email-templates/welcome-berg-starter.html';
/* Englische Fassungen (Sebi 25.10.2026: Newsletter zweisprachig). Erzeugt aus den deutschen
   Vorlagen per scripts/en-flaechen.mjs — nie von Hand aendern, dort die Tabelle nachziehen. */
import DOI_HTML_EN from '../../email-templates/confirm-doi.en.html';
import WELCOME_HTML_EN from '../../email-templates/welcome-berg-starter.en.html';

/* Je Sprache: Liste, Mails, Danke-Seite. Englisch geht auf eine eigene Brevo-Liste
   (NL_LIST_ID_EN) — die deutsche Liste bekommt nie eine englische Anmeldung und umgekehrt. */
const SPRACHEN = {
  de: { liste: (env) => Number(env.NL_LIST_ID), doi: () => DOI_HTML, starter: () => WELCOME_HTML,
    doiBetreff: 'Fast dabei — einmal bestätigen 🏔️', starterBetreff: 'Dein Berg-Starter 🏔️',
    danke: 'https://vegetarianhulk.de/danke.html', abmelden: 'Abmelden' },
  en: { liste: (env) => Number(env.NL_LIST_ID_EN), doi: () => DOI_HTML_EN, starter: () => WELCOME_HTML_EN,
    doiBetreff: 'Almost there — confirm once 🏔️', starterBetreff: 'Your Hike Starter 🏔️',
    danke: 'https://vegetarianhulk.de/en/thanks/', abmelden: 'Unsubscribe' },
};
/** Nur 'en' ist englisch; alles andere (auch Fehlendes) bleibt deutsch. */
const spracheVon = (wert) => (wert === 'en' ? 'en' : 'de');

const ALLOWED_ORIGINS = new Set([
  'https://vegetarianhulk.de',
  'https://www.vegetarianhulk.de',
  'http://localhost:8741',
]);

const MAIL_TO = 'info@vegetarianhulk.de';
const MAIL_FROM = { name: 'vegetarianhulk.de Formular', email: 'info@vegetarianhulk.de' };

const RATE_LIMIT_MAX = 5;            // Requests …
const RATE_LIMIT_WINDOW_MS = 600000; // … pro 10 Minuten pro IP
const MAX_FIELD_LEN = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ipHits = new Map(); // ip → [timestamps] (best-effort, pro Isolate)

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://vegetarianhulk.de';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) return true;
  ipHits.set(ip, [...hits, now]);
  // Map klein halten (Isolate lebt ohnehin nur begrenzt)
  if (ipHits.size > 5000) ipHits.clear();
  return false;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanField(value) {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LEN);
}

function buildMail(fields) {
  const rows = [
    ['Brand', fields.brand],
    ['Webseite/Insta', fields.link],
    ['Was/Produkt', fields.what],
    ['Art der Zusammenarbeit', fields.types],
    ['Budget', fields.budget],
    ['Zeitrahmen', fields.time],
    ['Idee', fields.idea],
    ['E-Mail', fields.email],
    ['Bevorzugte Kontaktform', fields.contact],
    ['Kontakt (Tel/WA/@)', fields.handle],
  ];
  const trs = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-weight:700;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v || '—')}</td></tr>`)
    .join('');
  return `<h2 style="font-family:Georgia,serif">Neue Brand-Anfrage: ${escapeHtml(fields.brand)}</h2>
<table style="font-family:system-ui,sans-serif;font-size:14px;border-collapse:collapse">${trs}</table>
<p style="font-size:12px;color:#666">Gesendet über vegetarianhulk.de/anfrage.html (vh-forms Worker)</p>`;
}

async function sendViaBrevo(apiKey, fields) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: MAIL_FROM,
      to: [{ email: MAIL_TO, name: 'Sebastian Wimmer' }],
      replyTo: { email: fields.email },
      subject: `Neue Brand-Anfrage: ${fields.brand}`,
      htmlContent: buildMail(fields),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/* --- Turnstile (Cloudflare CAPTCHA) ---
   Aktiv, sobald das Secret gesetzt ist (wrangler secret put TURNSTILE_SECRET).
   Ohne Secret wird die Schicht übersprungen — so lässt sich der Worker
   deployen, bevor das Widget existiert. Mit Secret: fail-closed, d.h.
   kaputte Antwort von Cloudflare = kein Durchlass (Muster aus s2s protect.js). */
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // Schicht (noch) nicht konfiguriert
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', String(token));
    if (ip && ip !== 'unknown') body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!res.ok) {
      console.error('vh-forms turnstile: HTTP', res.status);
      return false; // fail-closed
    }
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('vh-forms turnstile failed:', err.message || err);
    return false; // fail-closed
  }
}

/* --- Double-Opt-In, komplett selbst gebaut ---
   Brevos DOI-API verlangt einen Spezial-Vorlagen-Typ, der per API nicht
   anlegbar ist. Deshalb eigener Flow:
     1. POST /newsletter/subscribe → signierter Bestätigungs-Link (HMAC)
        + Mail über Brevos normalen Transactional-Versand (wie brand-inquiry)
     2. GET  /newsletter/confirm?t=… → Signatur prüfen → Kontakt in Liste
        → Redirect auf die Website
   Der Kontakt landet erst NACH dem Klick in der Liste = echtes DOI. */
const DOI_SENDER = { name: 'Sebi · VegetarianHulk', email: 'info@vegetarianhulk.de' };
const DOI_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // Link 7 Tage gültig

async function brevo(env, path, init = {}) {
  return fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY, ...(init.headers || {}) },
  });
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(str) {
  const pad = str.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/* Signier-Schlüssel aus dem Brevo-Key abgeleitet — kein zweites Secret nötig. */
async function doiKey(env) {
  const raw = new TextEncoder().encode('vh-doi-v1:' + env.BREVO_API_KEY);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/* Die Sprache steht mit im signierten Link (dritter Teil) — aeltere Links ohne sie bleiben deutsch. */
async function makeDoiToken(env, email, sprache = 'de') {
  const payload = new TextEncoder().encode(`${email}|${Date.now() + DOI_TOKEN_TTL_MS}${sprache === 'en' ? '|en' : ''}`);
  const sig = await crypto.subtle.sign('HMAC', await doiKey(env), payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

/* Gibt { email, sprache } zurück, wenn Token gültig + nicht abgelaufen — sonst null. */
async function verifyDoiToken(env, token) {
  try {
    const [p, s] = String(token).split('.');
    if (!p || !s) return null;
    const payload = b64urlDecode(p);
    const valid = await crypto.subtle.verify('HMAC', await doiKey(env), b64urlDecode(s), payload);
    if (!valid) return null;
    const [email, exp, sprache] = new TextDecoder().decode(payload).split('|');
    if (!EMAIL_RE.test(email)) return null;
    // Abgelaufen, aber echt signiert: die Sprache ist bekannt, damit die Erklaerung passt.
    if (Date.now() > Number(exp)) return { abgelaufen: true, sprache: spracheVon(sprache) };
    return { email, sprache: spracheVon(sprache) };
  } catch {
    return null;
  }
}

/* Merge-Tags fuellen: der Vorname bekommt den Standardwert der Vorlage („du“ / „there“).
   Ausdruecklich als replaceAll — scripts/mail-check.mjs liest genau diese Aufrufe. */
function fuellen(html, s) {
  return html
    .replaceAll('{{ contact.VORNAME | default : "du" }}', 'du')
    .replaceAll('{{ contact.VORNAME | default : "there" }}', 'there')
    .replaceAll('{{ unsubscribe }}', 'mailto:info@vegetarianhulk.de?subject=' + s.abmelden);
}

async function sendDoiMail(env, email, confirmUrl, sprache = 'de') {
  const s = SPRACHEN[sprache];
  const html = fuellen(s.doi().replaceAll('{{ doubleoptin }}', confirmUrl), s);
  const res = await brevo(env, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify({
      sender: DOI_SENDER,
      to: [{ email }],
      subject: s.doiBetreff,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo Mail ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/* Der Berg-Starter selbst. Bis 03.09.2026 versprach das Formular „dann kommt
   der Berg-Starter“, aber nirgends im Code stand ein Sendebefehl dafür — der
   Kontakt landete nur in der Liste. Ob eine Brevo-Automation ihn ausliefert,
   ist von hier aus unsichtbar und damit auch im Zeitverhalten nicht zusagbar.
   Deshalb schickt ihn der Worker jetzt selbst, direkt nach der Eintragung:
   damit ist „wie schnell“ beantwortbar (Sekunden) und nachprüfbar. */
async function sendStarterMail(env, email, sprache = 'de') {
  const s = SPRACHEN[sprache];
  const html = fuellen(s.starter(), s);
  const res = await brevo(env, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify({
      sender: DOI_SENDER,
      to: [{ email }],
      subject: s.starterBetreff,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo Starter ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/* Nach Bestätigungs-Klick: Kontakt in die Liste (idempotent). */
async function addContactToList(env, email, sprache = 'de') {
  const liste = SPRACHEN[sprache].liste(env);
  if (!liste) throw new Error(`keine Liste fuer Sprache ${sprache}`);
  const res = await brevo(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email,
      listIds: [liste],
      updateEnabled: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo Contact ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/* Baut das Redirect-Ziel. Vorher wurde '?bestaetigung=…' angehaengt — das
   ergibt eine kaputte URL, sobald NL_REDIRECT_URL selbst schon einen Query
   traegt. Die URL-API haengt sauber an und schluckt auch einen Tippfehler
   in der Variablen nicht still: faellt sie um, landet der Mensch auf der
   Standard-Danke-Seite statt auf einer Fehlerseite des Browsers. */
function bestaetigungsZiel(env, zustand, sprache = 'de') {
  const basis = SPRACHEN[sprache].danke;
  let ziel;
  try {
    ziel = new URL(sprache === 'en' ? basis : (env.NL_REDIRECT_URL || basis));
  } catch {
    console.error('vh-forms: NL_REDIRECT_URL ist keine gueltige URL, nutze Standard');
    ziel = new URL(basis);
  }
  ziel.searchParams.set('bestaetigung', zustand);
  return ziel.toString();
}

/* ============================================================
   KAMPAGNEN-ENTWURF ANLEGEN  —  POST /newsletter/kampagne

   Warum ueber den Worker und nicht lokal: der BREVO_API_KEY bleibt so,
   wo er ist. Ein Schluessel, der fuer ein Skript auf eine Festplatte
   kopiert wird, liegt danach dauerhaft dort.

   Der Endpunkt legt ausschliesslich einen ENTWURF an. Er kann nicht
   senden — es gibt keinen Pfad dafuer. Das ist Absicht: ein Tippfehler
   erreicht sonst in einem Zug die ganze Liste, und zurueckholen laesst
   sich eine Mail nicht. Den Versand loest ein Mensch in Brevo aus.

   Schutz: Bearer-Token (eigenes Secret, nicht der Brevo-Key), Vergleich
   in konstanter Zeit, Groessenbegrenzung, kein CORS — der Endpunkt ist
   fuer ein Skript da, nicht fuer einen Browser.
   ============================================================ */
const KAMPAGNE_MAX_HTML = 400000;   // 400 KB, jede echte Mail liegt weit darunter

/* Vergleich ohne fruehen Ausstieg: ein == verraet ueber die Laufzeit,
   wie viele Zeichen gestimmt haben. */
function gleichKonstant(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function handleKampagne(request, env) {
  if (!env.NL_ADMIN_TOKEN || !env.BREVO_API_KEY) {
    return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  }
  const kopf = request.headers.get('Authorization') || '';
  const token = kopf.startsWith('Bearer ') ? kopf.slice(7) : '';
  if (!gleichKonstant(token, env.NL_ADMIN_TOKEN)) {
    // absichtlich ohne Detail: was genau nicht stimmte, geht niemanden an
    return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid json' }, 400, ''); }

  const name = cleanField(body.name);
  const subject = cleanField(body.subject);
  const preheader = cleanField(body.preheader);
  const html = String(body.html ?? '');
  if (!name || !subject || !html) {
    return json({ ok: false, error: 'name, subject und html sind Pflicht' }, 400, '');
  }
  if (html.length > KAMPAGNE_MAX_HTML) {
    return json({ ok: false, error: `html zu gross (${html.length} > ${KAMPAGNE_MAX_HTML})` }, 413, '');
  }
  /* Ein Platzhalter, der bis hierher kommt, wuerde als "Hey {{ NAME }}"
     in der Kampagne stehen. Lieber hier abbrechen. */
  const offen = (html.replace(/\{\{ contact\.[^}]*\}\}|\{\{ unsubscribe \}\}/g, '')
                     .match(/\{\{[^}]{0,60}\}\}/g) || []);
  const liste = SPRACHEN[spracheVon(body.sprache)].liste(env);
  if (!liste) return json({ ok: false, error: `keine Liste fuer Sprache ${body.sprache}` }, 400, '');
  if (offen.length) {
    return json({ ok: false, error: `ungefuellte Platzhalter: ${[...new Set(offen)].join(', ')}` }, 400, '');
  }

  const res = await brevo(env, '/emailCampaigns', {
    method: 'POST',
    body: JSON.stringify({
      name,
      subject,
      previewText: preheader || undefined,
      sender: DOI_SENDER,
      htmlContent: html,
      recipients: { listIds: [liste] },
      inlineImageActivation: false,
      // KEIN scheduledAt und kein Senden: Brevo legt das als Entwurf ab.
    }),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('vh-forms kampagne failed:', res.status, text.slice(0, 200));
    return json({ ok: false, error: `Brevo ${res.status}: ${text.slice(0, 200)}` }, 502, '');
  }
  let id = null;
  try { id = JSON.parse(text).id; } catch {}
  return json({
    ok: true, id,
    hinweis: 'Entwurf angelegt. Senden loest ein Mensch in Brevo aus.',
    brevo: id ? `https://app.brevo.com/campaigns/classic/edit/${id}` : null,
  }, 200, '');
}

/* Stand einer Kampagne lesen — damit sich "es sendet nicht" BELEGEN laesst,
   statt es zu behaupten. Nur lesend, gleicher Token. */
async function handleKampagneStand(request, env) {
  if (!env.NL_ADMIN_TOKEN || !env.BREVO_API_KEY) return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  const kopf = request.headers.get('Authorization') || '';
  if (!gleichKonstant(kopf.startsWith('Bearer ') ? kopf.slice(7) : '', env.NL_ADMIN_TOKEN)) {
    return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!/^\d{1,10}$/.test(id || '')) return json({ ok: false, error: 'id fehlt' }, 400, '');
  const res = await brevo(env, `/emailCampaigns/${id}`, { method: 'GET' });
  const text = await res.text().catch(() => '');
  if (!res.ok) return json({ ok: false, error: `Brevo ${res.status}` }, 502, '');
  let d = {};
  try { d = JSON.parse(text); } catch {}
  /* Diagnose: ueberlebt der Kopf der Vorlage den Weg durch Brevo?
     Gmail dunkelt Textfarben ab, wenn die Mail sich nicht als dunkel
     ausweist — und genau das steht in <meta> und <style>, also in Teilen,
     die ein Kampagnen-Editor gerne entfernt. */
  const h = String(d.htmlContent || '');
  const marker = (m) => h.includes(m);
  return json({
    ok: true, id: d.id, name: d.name, subject: d.subject,
    status: d.status, scheduledAt: d.scheduledAt ?? null,
    empfaenger: d.recipients?.lists?.length ?? null,
    html_bytes: h.length,
    kopf: {
      meta_color_scheme: marker('name="color-scheme"'),
      meta_supported: marker('supported-color-schemes'),
      style_block: marker('<style>'),
      root_color_scheme: marker(':root { color-scheme'),
      bgcolor_anzahl: (h.match(/bgcolor=/g) || []).length,
    },
  }, 200, '');
}

/* Testmail einer Kampagne — POST /newsletter/kampagne/test

   Schickt die ECHTE Kampagne an wenige Adressen, nicht an die Liste.
   So laesst sich vor dem Versand pruefen, ob sie im Posteingang landet
   statt im Spam — mit genau dem Inhalt, der spaeter rausgeht.

   Eingegrenzt: nur eine BESTEHENDE Kampagne (keine freien Inhalte) und
   hoechstens 3 Empfaenger. Damit ist der Endpunkt auch bei einem
   abhandengekommenen Token kein brauchbares Versandwerkzeug fuer Fremde.
   Jeder Aufruf wird protokolliert. */
async function handleKampagneTest(request, env) {
  if (!env.NL_ADMIN_TOKEN || !env.BREVO_API_KEY) return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  const kopf = request.headers.get('Authorization') || '';
  if (!gleichKonstant(kopf.startsWith('Bearer ') ? kopf.slice(7) : '', env.NL_ADMIN_TOKEN)) {
    return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  }
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400, ''); }
  const id = String(body.id ?? '');
  if (!/^\d{1,10}$/.test(id)) return json({ ok: false, error: 'id fehlt' }, 400, '');
  const an = (Array.isArray(body.an) ? body.an : []).map(a => cleanField(a).toLowerCase()).filter(a => EMAIL_RE.test(a));
  if (!an.length) return json({ ok: false, error: 'keine gueltige Empfaengeradresse' }, 400, '');
  if (an.length > 3) return json({ ok: false, error: 'hoechstens 3 Empfaenger' }, 400, '');

  const res = await brevo(env, `/emailCampaigns/${id}/sendTest`, {
    method: 'POST', body: JSON.stringify({ emailTo: an }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('vh-forms test failed:', res.status, t.slice(0, 200));
    return json({ ok: false, error: `Brevo ${res.status}: ${t.slice(0, 160)}` }, 502, '');
  }
  console.log(`vh-forms: Testmail Kampagne ${id} an ${an.length} Adresse(n)`);
  return json({ ok: true, id: Number(id), an, hinweis: 'Testmail verschickt — die Liste bleibt unberuehrt' }, 200, '');
}

/* Versand ausloesen — POST /newsletter/kampagne/senden

   BEWUSST EIN EIGENER PFAD, NICHT EIN FLAG AM ANLEGEN.
   Wer einen Entwurf anlegt, soll nicht aus Versehen senden koennen. Der
   Versand braucht die Kampagnen-ID, die man nur kennt, wenn man den
   Entwurf vorher gesehen hat — und er ist nicht rueckholbar.

   Ausgeloest wird das nur auf ausdrueckliche Ansage von Sebi, nie
   nebenbei im Tour-Workflow. Deshalb steht es auch in KEINEM Skript-
   Standardpfad: es gibt kein "und dann senden" in tour-mail.mjs. */
async function handleKampagneSenden(request, env) {
  if (!env.NL_ADMIN_TOKEN || !env.BREVO_API_KEY) return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  const kopf = request.headers.get('Authorization') || '';
  if (!gleichKonstant(kopf.startsWith('Bearer ') ? kopf.slice(7) : '', env.NL_ADMIN_TOKEN)) {
    return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  }
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400, ''); }
  const id = String(body.id ?? '');
  if (!/^\d{1,10}$/.test(id)) return json({ ok: false, error: 'id fehlt' }, 400, '');
  /* Zweiter Schluessel im Body: ein versehentlicher Aufruf mit nur einer
     ID reicht nicht. Der Satz muss wortgleich mitgeschickt werden. */
  if (body.bestaetigung !== 'ja, an die liste senden') {
    return json({ ok: false, error: 'bestaetigung fehlt' }, 400, '');
  }
  const stand = await brevo(env, `/emailCampaigns/${id}`, { method: 'GET' });
  const d = await stand.json().catch(() => ({}));
  if (!stand.ok) return json({ ok: false, error: `Brevo ${stand.status}` }, 502, '');
  if (d.status !== 'draft') {
    return json({ ok: false, error: `Kampagne ${id} steht auf "${d.status}", nicht auf draft` }, 409, '');
  }
  const res = await brevo(env, `/emailCampaigns/${id}/sendNow`, { method: 'POST' });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('vh-forms senden failed:', res.status, t.slice(0, 200));
    return json({ ok: false, error: `Brevo ${res.status}: ${t.slice(0, 160)}` }, 502, '');
  }
  console.log(`vh-forms: Kampagne ${id} ("${d.subject}") an die Liste gesendet`);
  return json({ ok: true, id: Number(id), betreff: d.subject, hinweis: 'gesendet' }, 200, '');
}

/* ============================================================
   ENGLISCHE LISTE ANLEGEN  —  POST /newsletter/liste-en  (einmalig)
   Legt die Brevo-Liste fuer englische Anmeldungen im selben Ordner wie die
   deutsche an — oder liefert sie, wenn es sie schon gibt (idempotent). Die
   Nummer kommt danach als NL_LIST_ID_EN in wrangler.toml. Gleicher Schutz wie
   die Kampagnen-Endpunkte (NL_ADMIN_TOKEN); der Brevo-Key verlaesst den Worker nie.
   ============================================================ */
const LISTE_EN_NAME = 'vegetarianhulk-newsletter-en';

async function handleListeEn(request, env) {
  if (!env.NL_ADMIN_TOKEN || !env.BREVO_API_KEY) return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  const kopf = request.headers.get('Authorization') || '';
  if (!gleichKonstant(kopf.startsWith('Bearer ') ? kopf.slice(7) : '', env.NL_ADMIN_TOKEN)) {
    return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  }
  const alle = await brevo(env, '/contacts/lists?limit=50&offset=0');
  if (!alle.ok) return json({ ok: false, error: `Brevo ${alle.status}` }, 502, '');
  const da = ((await alle.json()).lists || []).find((l) => l.name === LISTE_EN_NAME);
  if (da) return json({ ok: true, id: da.id, neu: false }, 200, '');
  const de = await brevo(env, `/contacts/lists/${Number(env.NL_LIST_ID)}`);
  if (!de.ok) return json({ ok: false, error: `deutsche Liste nicht lesbar: Brevo ${de.status}` }, 502, '');
  const { folderId } = await de.json();
  const neu = await brevo(env, '/contacts/lists', { method: 'POST', body: JSON.stringify({ name: LISTE_EN_NAME, folderId }) });
  const text = await neu.text().catch(() => '');
  if (!neu.ok) return json({ ok: false, error: `Brevo ${neu.status}: ${text.slice(0, 160)}` }, 502, '');
  return json({ ok: true, id: JSON.parse(text).id, neu: true }, 200, '');
}

async function handleNewsletterConfirm(request, env) {
  const token = new URL(request.url).searchParams.get('t');
  const gueltig = await verifyDoiToken(env, token);
  if (!gueltig || gueltig.abgelaufen || !env.BREVO_API_KEY) {
    // abgelaufen/ungültig → Danke-Seite erklärt es und bietet neues Eintragen an
    return Response.redirect(bestaetigungsZiel(env, 'abgelaufen', gueltig?.sprache), 302);
  }
  const { email, sprache } = gueltig;
  try {
    await addContactToList(env, email, sprache);
    /* Getrennt abgefangen: die Eintragung IST gelungen, auch wenn der Versand
       hakt. Diesen Fall als 'fehler' zu melden wäre gelogen — und ihn als 'ok'
       zu melden hieße, jemanden auf eine Mail warten zu lassen, die nie kommt. */
    try {
      await sendStarterMail(env, email, sprache);
    } catch (mailErr) {
      console.error('vh-forms starter mail failed:', mailErr.message || mailErr);
      return Response.redirect(bestaetigungsZiel(env, 'ok-ohne-starter', sprache), 302);
    }
    return Response.redirect(bestaetigungsZiel(env, 'ok', sprache), 302);
  } catch (err) {
    console.error('vh-forms confirm failed:', err.message || err);
    return Response.redirect(bestaetigungsZiel(env, 'fehler', sprache), 302);
  }
}

async function handleNewsletter(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400, origin);
  }

  // Honeypot: Bots bekommen ein stilles "ok" — keine Mail
  if (cleanField(body._honey)) {
    return json({ ok: true }, 200, origin);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const turnstileOk = await verifyTurnstile(env, body.turnstileToken, clientIp);
  if (!turnstileOk) {
    return json({ ok: false, error: 'Sicherheitsprüfung fehlgeschlagen — bitte Seite neu laden.' }, 403, origin);
  }

  const email = cleanField(body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Gültige E-Mail ist Pflicht.' }, 400, origin);
  }
  const sprache = spracheVon(body.sprache);
  // Ohne englische Liste keine englische Anmeldung — nie still auf die deutsche Liste.
  if (!env.BREVO_API_KEY || !SPRACHEN[sprache].liste(env)) {
    return json({ ok: false, error: 'newsletter not configured' }, 503, origin);
  }

  try {
    const token = await makeDoiToken(env, email, sprache);
    const confirmUrl = new URL(request.url).origin + '/newsletter/confirm?t=' + encodeURIComponent(token);
    await sendDoiMail(env, email, confirmUrl, sprache);
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error('vh-forms newsletter failed:', err.message || err);
    return json({ ok: false, error: 'Anmeldung fehlgeschlagen — bitte später nochmal.' }, 502, origin);
  }
}

/* ============================================================
   INTERN  —  POST /intern/mail · POST /intern/newsletter (27.10.2026)
   Nur für den Wichtel-Worker (smashtheapp.de/wichteln) über eine Service-Bindung.
   Der Brevo-Schlüssel bleibt hier; Wichteln weist sich mit X-Intern (eigenes Secret
   INTERN_SCHLUESSEL) aus. Ohne Secret: 503, falscher Schlüssel: 401 ohne Detail.
   /intern/mail       {an, betreff, text}  → Transaktions-Mail (Absender Sebi · VegetarianHulk)
   /intern/newsletter {mail, vorname}      → Kontakt in Liste #5 + Berg-Starter, wie nach dem
                                             eigenen DOI; die Einwilligung (DOI) hat Wichteln
                                             vorher mit Bestätigungs-Link eingeholt und gespeichert.
   ============================================================ */
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function handleIntern(request, env, weg) {
  if (!env.INTERN_SCHLUESSEL || !env.BREVO_API_KEY) return json({ ok: false, error: 'nicht konfiguriert' }, 503, '');
  if (!gleichKonstant(request.headers.get('X-Intern') || '', env.INTERN_SCHLUESSEL)) return json({ ok: false, error: 'nicht berechtigt' }, 401, '');
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400, ''); }
  if (weg === 'mail') {
    const an = String(b.an || '').trim(), betreff = String(b.betreff || '').slice(0, 160), text = String(b.text || '').slice(0, 8000);
    if (!EMAIL_RE.test(an) || !betreff || !text) return json({ ok: false, error: 'Felder fehlen' }, 400, '');
    const html = `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#232a24;max-width:560px">${escHtml(text).replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
    const res = await brevo(env, '/smtp/email', { method: 'POST', body: JSON.stringify({ sender: DOI_SENDER, to: [{ email: an }], subject: betreff, textContent: text, htmlContent: html }) });
    if (!res.ok) { console.error('vh-forms intern/mail: Brevo', res.status); return json({ ok: false, error: 'Mail ging nicht raus' }, 502, ''); }
    return json({ ok: true }, 200, '');
  }
  const mail = String(b.mail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return json({ ok: false, error: 'Adresse fehlt' }, 400, '');
  try { await addContactToList(env, mail, 'de'); await sendStarterMail(env, mail, 'de'); }
  catch (e) { console.error('vh-forms intern/newsletter:', e.message); return json({ ok: false, error: 'Newsletter ging nicht' }, 502, ''); }
  return json({ ok: true }, 200, '');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method === 'POST' && (url.pathname === '/intern/mail' || url.pathname === '/intern/newsletter')) {
      return handleIntern(request, env, url.pathname.slice(8));
    }
    if (request.method === 'POST' && url.pathname === '/newsletter/subscribe') {
      const nlIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (isRateLimited(nlIp)) {
        return json({ ok: false, error: 'rate limited' }, 429, origin);
      }
      return handleNewsletter(request, env, origin);
    }
    if (request.method === 'POST' && url.pathname === '/newsletter/kampagne/test') {
      return handleKampagneTest(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/newsletter/kampagne/senden') {
      return handleKampagneSenden(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/newsletter/kampagne') {
      return handleKampagneStand(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/newsletter/kampagne') {
      return handleKampagne(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/newsletter/liste-en') {
      return handleListeEn(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/newsletter/confirm') {
      return handleNewsletterConfirm(request, env);
    }
    if (request.method !== 'POST' || url.pathname !== '/brand-inquiry') {
      return json({ ok: false, error: 'not found' }, 404, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ ok: false, error: 'rate limited' }, 429, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid json' }, 400, origin);
    }

    // Honeypot: Bots bekommen ein stilles "ok" — keine Mail
    if (cleanField(body._honey)) {
      return json({ ok: true }, 200, origin);
    }

    // Echtheits-Check (gleiche Schicht wie Newsletter, fail-closed sobald Secret gesetzt)
    const inquiryTurnstileOk = await verifyTurnstile(env, body.turnstileToken, ip);
    if (!inquiryTurnstileOk) {
      return json({ ok: false, error: 'Sicherheitsprüfung fehlgeschlagen — bitte Seite neu laden und nochmal senden.' }, 403, origin);
    }

    const fields = {
      brand: cleanField(body.brand),
      link: cleanField(body.link),
      what: cleanField(body.what),
      types: cleanField(Array.isArray(body.types) ? body.types.join(', ') : body.types),
      budget: cleanField(body.budget),
      time: cleanField(body.time),
      idea: cleanField(body.idea),
      email: cleanField(body.email).toLowerCase(),
      contact: cleanField(body.contact),
      handle: cleanField(body.handle),
    };

    if (!fields.brand || !EMAIL_RE.test(fields.email)) {
      return json({ ok: false, error: 'Brand und gültige E-Mail sind Pflicht.' }, 400, origin);
    }
    if (!env.BREVO_API_KEY) {
      return json({ ok: false, error: 'mail not configured' }, 503, origin);
    }

    try {
      await sendViaBrevo(env.BREVO_API_KEY, fields);
      return json({ ok: true }, 200, origin);
    } catch (err) {
      console.error('vh-forms send failed:', err.message || err);
      return json({ ok: false, error: 'Versand fehlgeschlagen — bitte direkt an info@vegetarianhulk.de schreiben.' }, 502, origin);
    }
  },
};
