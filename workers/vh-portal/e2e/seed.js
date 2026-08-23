export const SEED_SECRET = "dev-log-secret";

// Baut einen zusammenhaengenden Streak, der bis heute reicht — sonst zeigt das
// Band im Screenshot immer 0 Tage und die Sichtpruefung sieht den Normalfall nie.
export function daysAgo(offset, hour = 6) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

export async function seedActivity(request, overrides = {}) {
  const response = await request.post("/gipfelbuch/api/logbook/activity", {
    headers: { "X-VH-Log-Secret": SEED_SECRET },
    data: {
      workout: "Hiking",
      started_at: daysAgo(0),
      duration_s: 7200,
      distance_m: 12520,
      elevation_m: 1071,
      ...overrides,
    },
  });

  if (!response.ok()) {
    throw new Error(`Seed fehlgeschlagen: ${response.status()} ${await response.text()}`);
  }
}

export async function seedTypicalWeek(request) {
  await seedActivity(request, { workout: "Hiking", started_at: daysAgo(0), elevation_m: 1071, distance_m: 12520, duration_s: 24780 });
  await seedActivity(request, { workout: "Traditional Strength Training", started_at: daysAgo(1, 17), elevation_m: 0, distance_m: 0, duration_s: 4500 });
  await seedActivity(request, { workout: "Outdoor Run", started_at: daysAgo(2, 6), elevation_m: 120, distance_m: 8200, duration_s: 2760 });
  await seedActivity(request, { workout: "Cycling", started_at: daysAgo(3, 15), elevation_m: 430, distance_m: 42100, duration_s: 6300 });
  await seedActivity(request, { workout: "Walking", started_at: daysAgo(4, 12), elevation_m: 40, distance_m: 3100, duration_s: 1800 });
}
