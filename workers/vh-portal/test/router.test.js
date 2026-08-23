import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Router", () => {
  it("beantwortet den Health-Check", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "vh-portal" });
  });

  it("liefert 404 fuer unbekannte Pfade unter /gipfelbuch", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/gibtsnicht");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });

  it("setzt nosniff auf jede Antwort", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/health");

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
