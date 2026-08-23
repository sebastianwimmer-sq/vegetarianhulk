const MAX_HEART_RATE = 250;
const MIN_HEART_RATE = 25;
const MAX_DURATION_S = 86400;

// Apples Workout-Namen -> unsere Sportarten. Kleingeschrieben verglichen.
// Reihenfolge zaehlt: "Outdoor Cycle" darf nicht vorher an "walk" haengenbleiben.
const KIND_BY_KEYWORD = [
  ["hik", "wandern"],
  ["walk", "gehen"],
  ["run", "laufen"],
  ["cycl", "radfahren"],
  ["bike", "radfahren"],
  ["strength", "kraft"],
  ["swim", "schwimmen"],
];

function mapKind(rawKind) {
  const needle = rawKind.toLowerCase();
  const hit = KIND_BY_KEYWORD.find(([keyword]) => needle.includes(keyword));
  return hit ? hit[1] : "sonstiges";
}

function readInteger(value, field, errors, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    errors.push(`${field} ist keine Zahl`);
    return null;
  }
  if (parsed < 0) {
    errors.push(`${field} darf nicht negativ sein`);
    return null;
  }
  if (parsed < min || parsed > max) {
    errors.push(`${field} liegt ausserhalb des plausiblen Bereichs`);
    return null;
  }
  return Math.round(parsed);
}

export function parseActivityPayload(payload) {
  const errors = [];

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ["Nutzlast ist kein Objekt"] };
  }

  const rawKind = typeof payload.workout === "string" ? payload.workout.trim() : "";
  if (!rawKind) errors.push("workout fehlt");

  const startedAt = new Date(payload.started_at ?? "");
  if (Number.isNaN(startedAt.getTime())) errors.push("started_at ist kein gueltiger Zeitpunkt");

  const durationS = readInteger(payload.duration_s, "duration_s", errors, { min: 1, max: MAX_DURATION_S });
  if (durationS === null && !errors.some((message) => message.startsWith("duration_s"))) {
    errors.push("duration_s fehlt");
  }

  const distanceM = readInteger(payload.distance_m, "distance_m", errors);
  const elevationM = readInteger(payload.elevation_m, "elevation_m", errors);
  const kcal = readInteger(payload.kcal, "kcal", errors);
  const avgHr = readInteger(payload.avg_hr, "avg_hr", errors, { min: MIN_HEART_RATE, max: MAX_HEART_RATE });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: mapKind(rawKind),
      rawKind,
      startedAt: startedAt.toISOString(),
      durationS,
      distanceM,
      elevationM,
      kcal,
      avgHr,
    },
  };
}
