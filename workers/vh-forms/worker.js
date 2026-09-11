/* ============================================================
   vh-forms — Formular-Endpoints für vegetarianhulk.de
   POST /brand-inquiry        →  Mail via Brevo Transactional API
                                 an info@vegetarianhulk.de
   POST /newsletter/subscribe →  eigenes Double-Opt-In: signierter Link (HMAC)
                                 + Bestätigungs-Mail via Brevo Transactional
   GET  /newsletter/confirm    →  Link-Klick: Signatur prüfen → Kontakt in
                                 Liste → Redirect zur Website

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
const DOI_SUBJECT = 'Fast dabei — einmal bestätigen 🏔️';
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

async function makeDoiToken(env, email) {
  const payload = new TextEncoder().encode(`${email}|${Date.now() + DOI_TOKEN_TTL_MS}`);
  const sig = await crypto.subtle.sign('HMAC', await doiKey(env), payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

/* Gibt die E-Mail zurück, wenn Token gültig + nicht abgelaufen — sonst null. */
async function verifyDoiToken(env, token) {
  try {
    const [p, s] = String(token).split('.');
    if (!p || !s) return null;
    const payload = b64urlDecode(p);
    const valid = await crypto.subtle.verify('HMAC', await doiKey(env), b64urlDecode(s), payload);
    if (!valid) return null;
    const [email, exp] = new TextDecoder().decode(payload).split('|');
    if (!EMAIL_RE.test(email) || Date.now() > Number(exp)) return null;
    return email;
  } catch {
    return null;
  }
}

async function sendDoiMail(env, email, confirmUrl) {
  const html = DOI_HTML
    .replaceAll('{{ doubleoptin }}', confirmUrl)
    .replaceAll('{{ contact.VORNAME | default : "du" }}', 'du')
    .replaceAll('{{ unsubscribe }}', 'mailto:info@vegetarianhulk.de?subject=Abmelden');
  const res = await brevo(env, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify({
      sender: DOI_SENDER,
      to: [{ email }],
      subject: DOI_SUBJECT,
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
const STARTER_SUBJECT = 'Dein Berg-Starter 🏔️';

async function sendStarterMail(env, email) {
  const html = WELCOME_HTML
    .replaceAll('{{ contact.VORNAME | default : "du" }}', 'du')
    .replaceAll('{{ unsubscribe }}', 'mailto:info@vegetarianhulk.de?subject=Abmelden');
  const res = await brevo(env, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify({
      sender: DOI_SENDER,
      to: [{ email }],
      subject: STARTER_SUBJECT,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo Starter ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/* Nach Bestätigungs-Klick: Kontakt in die Liste (idempotent). */
async function addContactToList(env, email) {
  const res = await brevo(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email,
      listIds: [Number(env.NL_LIST_ID)],
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
function bestaetigungsZiel(env, zustand) {
  const basis = 'https://vegetarianhulk.de/danke.html';
  let ziel;
  try {
    ziel = new URL(env.NL_REDIRECT_URL || basis);
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
      recipients: { listIds: [Number(env.NL_LIST_ID)] },
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

async function handleNewsletterConfirm(request, env) {
  const token = new URL(request.url).searchParams.get('t');
  const email = await verifyDoiToken(env, token);
  if (!email || !env.BREVO_API_KEY) {
    // abgelaufen/ungültig → Danke-Seite erklärt es und bietet neues Eintragen an
    return Response.redirect(bestaetigungsZiel(env, 'abgelaufen'), 302);
  }
  try {
    await addContactToList(env, email);
    /* Getrennt abgefangen: die Eintragung IST gelungen, auch wenn der Versand
       hakt. Diesen Fall als 'fehler' zu melden wäre gelogen — und ihn als 'ok'
       zu melden hieße, jemanden auf eine Mail warten zu lassen, die nie kommt. */
    try {
      await sendStarterMail(env, email);
    } catch (mailErr) {
      console.error('vh-forms starter mail failed:', mailErr.message || mailErr);
      return Response.redirect(bestaetigungsZiel(env, 'ok-ohne-starter'), 302);
    }
    return Response.redirect(bestaetigungsZiel(env, 'ok'), 302);
  } catch (err) {
    console.error('vh-forms confirm failed:', err.message || err);
    return Response.redirect(bestaetigungsZiel(env, 'fehler'), 302);
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
  if (!env.BREVO_API_KEY || !Number(env.NL_LIST_ID)) {
    return json({ ok: false, error: 'newsletter not configured' }, 503, origin);
  }

  try {
    const token = await makeDoiToken(env, email);
    const confirmUrl = new URL(request.url).origin + '/newsletter/confirm?t=' + encodeURIComponent(token);
    await sendDoiMail(env, email, confirmUrl);
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error('vh-forms newsletter failed:', err.message || err);
    return json({ ok: false, error: 'Anmeldung fehlgeschlagen — bitte später nochmal.' }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
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
