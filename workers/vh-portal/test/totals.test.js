import { describe, expect, it } from "vitest";
import { summarise } from "../lib/totals.js";

const TODAY = new Date("2026-08-23T19:00:00.000Z");

function activity(startedAt, extra = {}) {
  return {
    id: startedAt,
    kind: "laufen",
    rawKind: "Running",
    startedAt,
    durationS: 3600,
    distanceM: 10000,
    elevationM: 100,
    kcal: null,
    avgHr: null,
    ...extra,
  };
}

describe("summarise", () => {
  it("liefert Nullwerte ohne Aktivitaeten", () => {
    expect(summarise([], TODAY)).toEqual({
      elevationM: 0,
      distanceKm: 0,
      activityCount: 0,
      streakDays: 0,
    });
  });

  it("summiert Hoehenmeter und Distanz", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z"), activity("2026-08-22T06:00:00.000Z", { elevationM: 250 })],
      TODAY
    );

    expect(result.elevationM).toBe(350);
    expect(result.distanceKm).toBe(20);
    expect(result.activityCount).toBe(2);
  });

  it("rundet die Distanz auf eine Nachkommastelle", () => {
    const result = summarise([activity("2026-08-23T06:00:00.000Z", { distanceM: 12520 })], TODAY);

    expect(result.distanceKm).toBe(12.5);
  });

  it("behandelt fehlende Messwerte als null Beitrag", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z", { distanceM: null, elevationM: null })],
      TODAY
    );

    expect(result.elevationM).toBe(0);
    expect(result.distanceKm).toBe(0);
  });

  it("zaehlt aufeinanderfolgende Tage als Streak", () => {
    const result = summarise(
      [
        activity("2026-08-23T06:00:00.000Z"),
        activity("2026-08-22T06:00:00.000Z"),
        activity("2026-08-21T06:00:00.000Z"),
      ],
      TODAY
    );

    expect(result.streakDays).toBe(3);
  });

  it("zaehlt mehrere Aktivitaeten am selben Tag nur einmal", () => {
    const result = summarise(
      [
        activity("2026-08-23T06:00:00.000Z"),
        activity("2026-08-23T18:00:00.000Z"),
        activity("2026-08-22T06:00:00.000Z"),
      ],
      TODAY
    );

    expect(result.streakDays).toBe(2);
  });

  it("laeuft weiter, wenn heute noch nichts passiert ist", () => {
    const result = summarise(
      [activity("2026-08-22T06:00:00.000Z"), activity("2026-08-21T06:00:00.000Z")],
      TODAY
    );

    expect(result.streakDays).toBe(2);
  });

  it("bricht den Streak bei einer Luecke ab", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z"), activity("2026-08-20T06:00:00.000Z")],
      TODAY
    );

    expect(result.streakDays).toBe(1);
  });

  it("liefert null, wenn die letzte Aktivitaet laenger her ist als gestern", () => {
    const result = summarise([activity("2026-08-19T06:00:00.000Z")], TODAY);

    expect(result.streakDays).toBe(0);
  });

  it("kommt ueber einen Monatswechsel hinweg", () => {
    const result = summarise(
      [
        activity("2026-08-01T06:00:00.000Z"),
        activity("2026-07-31T06:00:00.000Z"),
        activity("2026-07-30T06:00:00.000Z"),
      ],
      new Date("2026-08-01T20:00:00.000Z")
    );

    expect(result.streakDays).toBe(3);
  });
});
