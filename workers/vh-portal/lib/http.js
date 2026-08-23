// Auf JEDE Antwort, auch auf Fehler. Der Worker haengt unter derselben Domain
// wie die statische Site und darf hinter deren Schutz nicht zurueckfallen.
// max-age deckungsgleich mit dem, was GitHub Pages fuer vegetarianhulk.de
// ausliefert — bewusst ohne includeSubDomains, um keine Subdomain zu erschlagen.
const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31556952",
};

export function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...init.headers },
  });
}

export function htmlResponse(markup, init = {}) {
  return new Response(markup, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, "Content-Type": "text/html; charset=utf-8", ...init.headers },
  });
}

export function errorResponse(status, code, message) {
  return jsonResponse({ error: code, message }, { status });
}
