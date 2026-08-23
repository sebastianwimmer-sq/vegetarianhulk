import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Sicherheits-Header gehoeren auf JEDE Antwort, nicht nur auf die Seite.
// Die statische Site liefert sie ueber GitHub Pages beziehungsweise Meta-Tags —
// der Worker haengt unter derselben Domain und darf nicht dahinter zurueckfallen.
const ENDPOINTS = [
  ["Seite", "https://vegetarianhulk.de/gipfelbuch/"],
  ["Health", "https://vegetarianhulk.de/gipfelbuch/api/health"],
  ["Logbuch", "https://vegetarianhulk.de/gipfelbuch/api/logbook"],
  ["Fehlerfall", "https://vegetarianhulk.de/gipfelbuch/api/gibtsnicht"],
];

describe("Sicherheits-Header", () => {
  for (const [name, url] of ENDPOINTS) {
    it(`${name}: nosniff, Referrer-Policy, Rahmenschutz und HSTS`, async () => {
      const response = await SELF.fetch(url);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    });
  }

  it("die Seite verbietet das Einbetten per CSP-Header, nicht per Meta", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/");

    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");

    // Im Meta-Tag wird die Direktive ignoriert und loggt nur einen Fehler.
    expect(await response.text()).not.toContain("frame-ancestors");
  });

  it("erlaubt keine fremden Ursprünge per CORS", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/logbook");

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
