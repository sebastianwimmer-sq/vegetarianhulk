import { insertActivity } from "../lib/db.js";
import { errorResponse, jsonResponse } from "../lib/http.js";
import { matchesSecret } from "../lib/secret.js";
import { parseActivityPayload } from "../lib/validate.js";

export async function handleActivityIngest(request, env) {
  if (!env.LOG_SECRET) {
    console.error("LOG_SECRET fehlt — Aufnahme abgewiesen");
    return errorResponse(503, "not_configured", "Der Endpunkt ist nicht eingerichtet.");
  }

  const isAuthorised = await matchesSecret(request.headers.get("X-VH-Log-Secret"), env.LOG_SECRET);
  if (!isAuthorised) {
    return errorResponse(401, "unauthorized", "Zugang verweigert.");
  }

  if (env.PORTAL_WRITES === "off") {
    return errorResponse(503, "writes_disabled", "Schreibzugriffe sind gerade abgeschaltet.");
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "bad_json", "Die Nutzlast ist kein gueltiges JSON.");
  }

  const parsed = parseActivityPayload(payload);
  if (!parsed.ok) {
    return jsonResponse({ error: "invalid_payload", errors: parsed.errors }, { status: 422 });
  }

  const { id, isNew } = await insertActivity(env.DB, parsed.value);

  return jsonResponse({ ok: true, id, created: isNew }, { status: isNew ? 201 : 200 });
}
