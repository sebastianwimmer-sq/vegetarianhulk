import { insertActivity, listActivitiesSince, listRecentActivities } from "../lib/db.js";
import { errorResponse, jsonResponse } from "../lib/http.js";
import { matchesSecret } from "../lib/secret.js";
import { summarise } from "../lib/totals.js";
import { parseActivityPayload } from "../lib/validate.js";

const RECENT_LIMIT = 10;
const CACHE_SECONDS = 120;

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

// Nur die Felder, die das Band wirklich zeigt. Interne Spalten und die id
// bleiben drin, damit die oeffentliche Antwort nichts preisgibt, was sie nicht muss.
function toPublicActivity(item) {
  return {
    kind: item.kind,
    startedAt: item.startedAt,
    durationS: item.durationS,
    distanceM: item.distanceM,
    elevationM: item.elevationM,
    kcal: item.kcal,
    avgHr: item.avgHr,
  };
}

export async function loadLogbook(db, now) {
  const year = now.getUTCFullYear();

  const [recent, thisYear] = await Promise.all([
    listRecentActivities(db, RECENT_LIMIT),
    listActivitiesSince(db, `${year}-01-01T00:00:00.000Z`),
  ]);

  return { activities: recent, totals: summarise(thisYear, now), year };
}

export async function handleLogbookRead(request, env) {
  const { activities, totals, year } = await loadLogbook(env.DB, new Date());

  return jsonResponse(
    { activities: activities.map(toPublicActivity), totals, year },
    { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } }
  );
}
