/* ============================================================
   vh-forms — Brand-Anfrage-Endpoint für vegetarianhulk.de
   POST /brand-inquiry  →  Mail via Brevo Transactional API
   an info@vegetarianhulk.de (Ersatz für FormSubmit/US-Drittanbieter).

   Schutz: Honeypot (_honey) + best-effort Rate-Limit pro IP
   (in-memory pro Isolate — bewusst ohne KV, reicht gegen simple Bots).
   Ohne BREVO_API_KEY-Secret antwortet der Worker 503 — das Frontend
   fällt dann auf den mailto-Flow zurück.
   ============================================================ */

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
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
