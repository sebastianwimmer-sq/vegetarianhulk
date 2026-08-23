import { errorResponse, jsonResponse } from "./lib/http.js";
import { handleActivityIngest, handleLogbookRead } from "./routes/logbook.js";
import { handleGipfelbuchPage } from "./routes/page.js";

const PREFIX = "/gipfelbuch";

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      console.error("unhandled", error?.stack ?? String(error));
      return errorResponse(500, "internal_error", "Da ist etwas schiefgelaufen.");
    }
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(PREFIX)) {
    return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
  }

  const path = url.pathname.slice(PREFIX.length) || "/";

  if (request.method === "GET" && (path === "/" || path === "")) {
    return handleGipfelbuchPage(request, env);
  }

  if (request.method === "GET" && path === "/api/health") {
    return jsonResponse({ ok: true, service: "vh-portal" });
  }

  if (request.method === "POST" && path === "/api/logbook/activity") {
    return handleActivityIngest(request, env);
  }

  if (request.method === "GET" && path === "/api/logbook") {
    return handleLogbookRead(request, env);
  }

  return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
}
