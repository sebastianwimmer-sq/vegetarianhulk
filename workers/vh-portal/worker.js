import { errorResponse, jsonResponse } from "./lib/http.js";
import { handleActivityIngest, handleLogbookRead } from "./routes/logbook.js";
import { handleGipfelbuchPage } from "./routes/page.js";
import { handleShellRequest } from "./lib/dev-shell.js";

const PREFIX = "/gipfelbuch";

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (error) {
      console.error("unhandled", error?.stack ?? String(error));
      return errorResponse(500, "internal_error", "Da ist etwas schiefgelaufen.");
    }
  },
};

// HEAD wird wie GET geroutet und danach um den Rumpf erleichtert. Ohne das
// antwortet jedes `curl -I`, jeder Crawler und jedes Monitoring mit 404 auf
// einer intakten Seite. Schreibpfade bleiben unberuehrt, weil sie ausdruecklich
// auf POST pruefen.
async function handle(request, env, ctx) {
  const isHead = request.method === "HEAD";
  const response = await route(request, env, ctx, isHead ? "GET" : request.method);

  if (!isHead) return response;

  return new Response(null, { status: response.status, headers: response.headers });
}

async function route(request, env, ctx, method) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(PREFIX)) {
    // Nur lokal aktiv, siehe lib/dev-shell.js. Produktiv immer null.
    const shell = await handleShellRequest(request, env);
    if (shell) return shell;

    return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
  }

  const path = url.pathname.slice(PREFIX.length) || "/";

  if (method === "GET" && (path === "/" || path === "")) {
    return handleGipfelbuchPage(request, env);
  }

  if (method === "GET" && path === "/api/health") {
    return jsonResponse({ ok: true, service: "vh-portal" });
  }

  if (method === "POST" && path === "/api/logbook/activity") {
    return handleActivityIngest(request, env);
  }

  if (method === "GET" && path === "/api/logbook") {
    return handleLogbookRead(request, env);
  }

  return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
}
