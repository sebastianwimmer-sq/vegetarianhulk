import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity, listActivitiesSince, listRecentActivities } from "../lib/db.js";

const BASE = {
  kind: "wandern",
  rawKind: "Hiking",
  startedAt: "2026-08-20T06:30:00.000Z",
  durationS: 7200,
  distanceM: 12520,
  elevationM: 1071,
  kcal: 2085,
  avgHr: 117,
};

describe("Aktivitaeten-Speicher", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("legt eine Aktivitaet an und liest sie zurueck", async () => {
    const { id, isNew } = await insertActivity(env.DB, BASE);

    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const [stored] = await listRecentActivities(env.DB, 10);
    expect(stored).toMatchObject({ kind: "wandern", elevationM: 1071, avgHr: 117 });
  });

  it("ist idempotent bei gleicher Sportart und Startzeit", async () => {
    const first = await insertActivity(env.DB, BASE);
    const second = await insertActivity(env.DB, BASE);

    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await listRecentActivities(env.DB, 10)).toHaveLength(1);
  });

  it("sortiert die neueste Aktivitaet nach vorne und begrenzt die Menge", async () => {
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-18T06:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-21T06:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-19T06:00:00.000Z" });

    const rows = await listRecentActivities(env.DB, 2);

    expect(rows.map((row) => row.startedAt)).toEqual([
      "2026-08-21T06:00:00.000Z",
      "2026-08-19T06:00:00.000Z",
    ]);
  });

  it("liefert nur Aktivitaeten ab dem Stichtag", async () => {
    await insertActivity(env.DB, { ...BASE, startedAt: "2025-12-31T10:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-01-02T10:00:00.000Z" });

    const rows = await listActivitiesSince(env.DB, "2026-01-01T00:00:00.000Z");

    expect(rows).toHaveLength(1);
    expect(rows[0].startedAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it("erlaubt fehlende optionale Werte", async () => {
    await insertActivity(env.DB, {
      kind: "kraft",
      rawKind: "Traditional Strength Training",
      startedAt: "2026-08-22T17:00:00.000Z",
      durationS: 3600,
      distanceM: null,
      elevationM: null,
      kcal: null,
      avgHr: null,
    });

    const [stored] = await listRecentActivities(env.DB, 1);
    expect(stored.distanceM).toBeNull();
    expect(stored.kcal).toBeNull();
  });
});
