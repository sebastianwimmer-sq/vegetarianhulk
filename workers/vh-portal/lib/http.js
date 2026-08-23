const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
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
