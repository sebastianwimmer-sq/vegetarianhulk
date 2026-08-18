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
import DOI_HTML from './doi-template.html';

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

async function handleNewsletterConfirm(request, env) {
  const redirect = env.NL_REDIRECT_URL || 'https://vegetarianhulk.de/';
  const token = new URL(request.url).searchParams.get('t');
  const email = await verifyDoiToken(env, token);
  if (!email || !env.BREVO_API_KEY) {
    // abgelaufen/ungültig → freundlich zur Seite (dort kann man sich neu eintragen)
    return Response.redirect(redirect + '?bestaetigung=abgelaufen', 302);
  }
  try {
    await addContactToList(env, email);
    return Response.redirect(redirect + '?bestaetigung=ok', 302);
  } catch (err) {
    console.error('vh-forms confirm failed:', err.message || err);
    return Response.redirect(redirect + '?bestaetigung=fehler', 302);
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
