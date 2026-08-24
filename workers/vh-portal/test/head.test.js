import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// HEAD muss sich wie GET verhalten, nur ohne Rumpf. Sonst melden Monitoring,
// Crawler und jedes `curl -I` einen 404 auf einer intakten Seite — genau das
// steht in der Deploy-Prueffliste.
const READABLE = [
  "https://vegetarianhulk.de/gipfelbuch/",
  "https://vegetarianhulk.de/gipfelbuch/api/health",
  "https://vegetarianhulk.de/gipfelbuch/api/logbook",
];

describe("HEAD-Anfragen", () => {
  for (const url of READABLE) {
    it(`${new URL(url).pathname} antwortet auf HEAD mit 200`, async () => {
      const response = await SELF.fetch(url, { method: "HEAD" });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  }

  it("liefert bei HEAD dieselben Header wie bei GET", async () => {
    const url = "https://vegetarianhulk.de/gipfelbuch/";
    const [head, get] = await Promise.all([
      SELF.fetch(url, { method: "HEAD" }),
      SELF.fetch(url),
    ]);

    for (const name of ["Content-Type", "Content-Security-Policy", "X-Frame-Options", "Cache-Control"]) {
      expect(head.headers.get(name)).toBe(get.headers.get(name));
    }
  });

  it("oeffnet mit HEAD keinen Schreibpfad", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/logbook/activity", {
      method: "HEAD",
    });

    expect(response.status).toBe(404);
  });
});
