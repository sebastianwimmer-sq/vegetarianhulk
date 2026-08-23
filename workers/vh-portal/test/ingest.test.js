import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const URL_INGEST = "https://vegetarianhulk.de/gipfelbuch/api/logbook/activity";
const SECRET = "test-log-secret-0123456789";

const PAYLOAD = {
  workout: "Hiking",
  started_at: "2026-08-20T06:30:00Z",
  duration_s: 7200,
  distance_m: 12520,
  elevation_m: 1071,
};

function post(body, headers = {}) {
  return SELF.fetch(URL_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Logbuch-Aufnahme", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("nimmt eine gueltige Aktivitaet mit korrektem Secret an", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, created: true });
  });

  it("antwortet beim zweiten identischen Senden mit 200 statt Dublette", async () => {
    await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: false });

    const { results } = await env.DB.prepare("SELECT id FROM activities").all();
    expect(results).toHaveLength(1);
  });

  it("weist eine Anfrage ohne Secret ab", async () => {
    const response = await post(PAYLOAD);

    expect(response.status).toBe(401);
    const { results } = await env.DB.prepare("SELECT id FROM activities").all();
    expect(results).toHaveLength(0);
  });

  it("weist ein falsches Secret ab", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": "falsch" });

    expect(response.status).toBe(401);
  });

  it("verraet im Fehlertext nichts ueber das Secret", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": "falsch" });
    const text = await response.text();

    expect(text).not.toContain(SECRET);
  });

  it("weist eine unvollstaendige Nutzlast mit 422 ab", async () => {
    const response = await post({ workout: "Hiking" }, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(422);
    expect((await response.json()).errors.length).toBeGreaterThan(0);
  });

  it("weist unlesbares JSON mit 400 ab", async () => {
    const response = await SELF.fetch(URL_INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-VH-Log-Secret": SECRET },
      body: "{kaputt",
    });

    expect(response.status).toBe(400);
  });

  it("lehnt GET auf den Aufnahme-Endpunkt ab", async () => {
    const response = await SELF.fetch(URL_INGEST);

    expect(response.status).toBe(404);
  });
});
