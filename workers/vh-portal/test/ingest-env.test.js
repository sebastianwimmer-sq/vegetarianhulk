import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleActivityIngest } from "../routes/logbook.js";

// Diese beiden Faelle haengen an der Umgebung des Workers. Ueber SELF.fetch sind
// sie nicht pruefbar — der Worker liest dort seine eigene, aus wrangler.toml
// gebaute Umgebung, und ein veraendertes env im Test erreicht ihn nicht.
// Deshalb hier direkt gegen den Handler, mit gezielt kaputter Umgebung.

const PAYLOAD = {
  workout: "Hiking",
  started_at: "2026-08-24T06:30:00Z",
  duration_s: 3600,
};

function buildRequest(secret) {
  return new Request("https://vegetarianhulk.de/gipfelbuch/api/logbook/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-VH-Log-Secret": secret },
    body: JSON.stringify(PAYLOAD),
  });
}

async function countActivities() {
  const { results } = await env.DB.prepare("SELECT id FROM activities").all();
  return results.length;
}

describe("Logbuch-Aufnahme unter besonderen Umgebungen", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("schliesst zu, wenn das Secret in der Umgebung fehlt", async () => {
    const brokenEnv = { DB: env.DB, PORTAL_WRITES: "on" };

    const response = await handleActivityIngest(buildRequest("irgendwas"), brokenEnv);

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("not_configured");
    expect(await countActivities()).toBe(0);
  });

  it("schliesst auch bei leerem Secret zu, statt jeden durchzulassen", async () => {
    const brokenEnv = { DB: env.DB, PORTAL_WRITES: "on", LOG_SECRET: "" };

    const response = await handleActivityIngest(buildRequest(""), brokenEnv);

    expect(response.status).toBe(503);
    expect(await countActivities()).toBe(0);
  });

  it("schreibt nichts, wenn der Kill-Switch aus ist", async () => {
    const offEnv = { DB: env.DB, PORTAL_WRITES: "off", LOG_SECRET: env.LOG_SECRET };

    const response = await handleActivityIngest(buildRequest(env.LOG_SECRET), offEnv);

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("writes_disabled");
    expect(await countActivities()).toBe(0);
  });

  it("laesst bei aktivem Kill-Switch trotzdem kein falsches Secret durch", async () => {
    const offEnv = { DB: env.DB, PORTAL_WRITES: "off", LOG_SECRET: env.LOG_SECRET };

    const response = await handleActivityIngest(buildRequest("falsch"), offEnv);

    expect(response.status).toBe(401);
  });
});
