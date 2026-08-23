import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity } from "../lib/db.js";

const URL_READ = "https://vegetarianhulk.de/gipfelbuch/api/logbook";

function activity(startedAt, extra = {}) {
  return {
    kind: "wandern",
    rawKind: "Hiking",
    startedAt,
    durationS: 7200,
    distanceM: 10000,
    elevationM: 500,
    kcal: null,
    avgHr: null,
    ...extra,
  };
}

describe("Oeffentliches Logbuch", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("liefert eine leere, aber vollstaendige Struktur ohne Daten", async () => {
    const response = await SELF.fetch(URL_READ);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      activities: [],
      totals: { elevationM: 0, distanceKm: 0, activityCount: 0, streakDays: 0 },
    });
  });

  it("liefert die neuesten Aktivitaeten zuerst", async () => {
    await insertActivity(env.DB, activity("2026-08-20T06:00:00.000Z"));
    await insertActivity(env.DB, activity("2026-08-22T06:00:00.000Z", { kind: "laufen" }));

    const { activities } = await (await SELF.fetch(URL_READ)).json();

    expect(activities[0].startedAt).toBe("2026-08-22T06:00:00.000Z");
  });

  it("zaehlt fuer die Summen nur das laufende Jahr", async () => {
    await insertActivity(env.DB, activity(`${new Date().getUTCFullYear() - 1}-06-01T06:00:00.000Z`));
    await insertActivity(env.DB, activity(`${new Date().getUTCFullYear()}-06-01T06:00:00.000Z`));

    const { totals } = await (await SELF.fetch(URL_READ)).json();

    expect(totals.activityCount).toBe(1);
    expect(totals.elevationM).toBe(500);
  });

  it("gibt hoechstens zehn Aktivitaeten aus", async () => {
    for (let day = 1; day <= 12; day += 1) {
      const padded = String(day).padStart(2, "0");
      await insertActivity(env.DB, activity(`2026-07-${padded}T06:00:00.000Z`));
    }

    const { activities } = await (await SELF.fetch(URL_READ)).json();

    expect(activities).toHaveLength(10);
  });

  it("erlaubt kurzes Zwischenspeichern", async () => {
    const response = await SELF.fetch(URL_READ);

    expect(response.headers.get("Cache-Control")).toContain("max-age");
  });

  it("gibt keine internen Spalten preis", async () => {
    await insertActivity(env.DB, activity("2026-08-22T06:00:00.000Z"));

    const body = await (await SELF.fetch(URL_READ)).text();

    expect(body).not.toContain("created_at");
    expect(body).not.toContain("raw_kind");
    expect(body).not.toContain("rawKind");
    expect(body).not.toContain('"id"');
  });
});
