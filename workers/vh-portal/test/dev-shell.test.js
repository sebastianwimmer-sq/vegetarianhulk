import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleShellRequest } from "../lib/dev-shell.js";

describe("Entwicklungs-Shell", () => {
  it("ist ohne Schalter aus — Pfade ausserhalb /gipfelbuch bleiben 404", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/v3.css");

    expect(response.status).toBe(404);
  });

  it("gibt ohne Schalter null zurueck, statt irgendwohin zu greifen", async () => {
    const result = await handleShellRequest(new Request("https://x.test/v3.css"), {});

    expect(result).toBeNull();
  });

  it("holt nur von der eigenen Domain, egal was angefragt wird", async () => {
    const calls = [];
    const fakeFetch = async (url) => {
      calls.push(url);
      return new Response("/* css */", { headers: { "content-type": "text/css" } });
    };

    await handleShellRequest(
      new Request("https://boese.example/fonts.css"),
      { DEV_SHELL_PROXY: "on" },
      fakeFetch
    );

    expect(calls).toEqual(["https://vegetarianhulk.de/fonts.css"]);
  });

  it("laesst nur bekannte Shell-Pfade durch", async () => {
    const config = { DEV_SHELL_PROXY: "on" };
    const never = async () => new Response("sollte nie passieren");

    expect(await handleShellRequest(new Request("https://x.test/impressum.html"), config, never)).toBeNull();
    expect(await handleShellRequest(new Request("https://x.test/../etc/passwd"), config, never)).toBeNull();
  });

  it("reicht die Shell durch, wenn der Schalter an ist", async () => {
    const fakeFetch = async () => new Response("body{}", { headers: { "content-type": "text/css" } });

    const response = await handleShellRequest(
      new Request("https://x.test/v3.css"),
      { DEV_SHELL_PROXY: "on" },
      fakeFetch
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("body{}");
  });

  it("ist in der Testumgebung nicht versehentlich aktiv", () => {
    expect(env.DEV_SHELL_PROXY ?? "").not.toBe("on");
  });
});
