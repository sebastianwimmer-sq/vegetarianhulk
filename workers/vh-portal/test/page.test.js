import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity } from "../lib/db.js";
import { escapeHtml, formatDuration } from "../lib/render.js";

const URL_PAGE = "https://vegetarianhulk.de/gipfelbuch/";
const YEAR = new Date().getUTCFullYear();

describe("escapeHtml", () => {
  it("entschaerft spitze Klammern und Anfuehrungszeichen", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("laesst harmlosen Text unveraendert", () => {
    expect(escapeHtml("Ristfeuchthorn")).toBe("Ristfeuchthorn");
  });
});

describe("formatDuration", () => {
  it("formatiert Stunden und Minuten", () => {
    expect(formatDuration(7200)).toBe("2:00 h");
    expect(formatDuration(4500)).toBe("1:15 h");
  });

  it("formatiert weniger als eine Stunde als Minuten", () => {
    expect(formatDuration(1800)).toBe("30 min");
  });
});

describe("Gipfelbuch-Seite", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("liefert HTML aus", async () => {
    const response = await SELF.fetch(URL_PAGE);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });

  it("zeigt einen Leerzustand ohne Aktivitaeten", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toContain("Noch nichts eingetragen");
  });

  it("zeigt die Summen des Jahres", async () => {
    await insertActivity(env.DB, {
      kind: "wandern",
      rawKind: "Hiking",
      startedAt: `${YEAR}-08-20T06:00:00.000Z`,
      durationS: 7200,
      distanceM: 12520,
      elevationM: 1071,
      kcal: null,
      avgHr: null,
    });

    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toContain("1.071");
    expect(html).toContain("12,5");
  });

  it("benutzt niemals data-hm, weil v3.js das ueberschreibt", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).not.toMatch(/data-hm[=\s]/);
  });

  it("bringt keine unsichere CSP-Direktive mit", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).not.toContain("upgrade-insecure-requests");
  });

  it("setzt Titel und Beschreibung", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('name="description"');
  });

  it("laedt die geteilte v3-Gestaltung statt eigener Schriften", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toContain("/v3.css");
    expect(html).toContain("/fonts.css");
  });

  it("entschaerft eine Sportart, die HTML enthaelt", async () => {
    await insertActivity(env.DB, {
      kind: "sonstiges",
      rawKind: '<script>alert(1)</script>',
      startedAt: `${YEAR}-08-19T06:00:00.000Z`,
      durationS: 3600,
      distanceM: null,
      elevationM: null,
      kcal: null,
      avgHr: null,
    });

    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
