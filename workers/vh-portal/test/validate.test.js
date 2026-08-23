import { describe, expect, it } from "vitest";
import { parseActivityPayload } from "../lib/validate.js";

const VALID = {
  workout: "Hiking",
  started_at: "2026-08-20T06:30:00Z",
  duration_s: 7200,
  distance_m: 12520,
  elevation_m: 1071,
  kcal: 2085,
  avg_hr: 117,
};

describe("parseActivityPayload", () => {
  it("nimmt eine vollstaendige Nutzlast an", () => {
    const result = parseActivityPayload(VALID);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      kind: "wandern",
      rawKind: "Hiking",
      startedAt: "2026-08-20T06:30:00.000Z",
      durationS: 7200,
      distanceM: 12520,
      elevationM: 1071,
      kcal: 2085,
      avgHr: 117,
    });
  });

  it("ordnet Apples Sportarten zu", () => {
    const cases = [
      ["Running", "laufen"],
      ["Outdoor Run", "laufen"],
      ["Cycling", "radfahren"],
      ["Outdoor Cycle", "radfahren"],
      ["Hiking", "wandern"],
      ["Traditional Strength Training", "kraft"],
      ["Functional Strength Training", "kraft"],
      ["Walking", "gehen"],
    ];

    for (const [workout, expected] of cases) {
      expect(parseActivityPayload({ ...VALID, workout }).value.kind).toBe(expected);
    }
  });

  it("faellt bei unbekannter Sportart auf sonstiges zurueck und behaelt das Original", () => {
    const result = parseActivityPayload({ ...VALID, workout: "Underwater Basket Weaving" });

    expect(result.value.kind).toBe("sonstiges");
    expect(result.value.rawKind).toBe("Underwater Basket Weaving");
  });

  it("nimmt Zahlen auch als Text an, weil Kurzbefehle so senden", () => {
    const result = parseActivityPayload({ ...VALID, duration_s: "7200", elevation_m: "1071" });

    expect(result.value.durationS).toBe(7200);
    expect(result.value.elevationM).toBe(1071);
  });

  it("laesst optionale Felder weg", () => {
    const result = parseActivityPayload({
      workout: "Traditional Strength Training",
      started_at: "2026-08-22T17:00:00Z",
      duration_s: 3600,
    });

    expect(result.ok).toBe(true);
    expect(result.value.distanceM).toBeNull();
    expect(result.value.avgHr).toBeNull();
  });

  it("weist eine fehlende Sportart ab", () => {
    const { workout, ...rest } = VALID;
    const result = parseActivityPayload(rest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("workout fehlt");
  });

  it("weist ein unlesbares Datum ab", () => {
    const result = parseActivityPayload({ ...VALID, started_at: "gestern frueh" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("started_at ist kein gueltiger Zeitpunkt");
  });

  it("weist eine nicht positive Dauer ab", () => {
    expect(parseActivityPayload({ ...VALID, duration_s: 0 }).ok).toBe(false);
    expect(parseActivityPayload({ ...VALID, duration_s: -5 }).ok).toBe(false);
  });

  it("weist negative Messwerte ab", () => {
    const result = parseActivityPayload({ ...VALID, distance_m: -1 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("distance_m darf nicht negativ sein");
  });

  it("weist unsinnig hohe Pulswerte ab", () => {
    const result = parseActivityPayload({ ...VALID, avg_hr: 400 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("avg_hr liegt ausserhalb des plausiblen Bereichs");
  });

  it("weist etwas ab, das kein Objekt ist", () => {
    expect(parseActivityPayload(null).ok).toBe(false);
    expect(parseActivityPayload("Hiking").ok).toBe(false);
  });

  it("sammelt mehrere Fehler auf einmal", () => {
    const result = parseActivityPayload({ started_at: "kaputt", duration_s: -1 });

    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
