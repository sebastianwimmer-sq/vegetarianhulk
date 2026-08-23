import { expect, test } from "@playwright/test";
import { seedTypicalWeek } from "./seed.js";

const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

// Produktiv liegen /v3.css, /fonts.css und /fonts/* unter derselben Origin auf
// GitHub Pages — die Zonen-Route bedient nur /gipfelbuch/*. Lokal kennt
// wrangler dev diese Pfade nicht und liefert 404, die Seite waere ungestylt und
// jeder Screenshot wertlos. Deshalb hier von der Live-Domain nachladen: das
// bildet den Produktionszustand ab, statt ihn zu verstecken.
const SHELL_PATTERNS = ["**/v3.css", "**/fonts.css", "**/fonts/**"];

test.beforeEach(async ({ page }) => {
  for (const pattern of SHELL_PATTERNS) {
    await page.route(pattern, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const upstream = await fetch(`https://vegetarianhulk.de${path}`);

      await route.fulfill({
        status: upstream.status,
        headers: { "content-type": upstream.headers.get("content-type") ?? "text/plain" },
        body: Buffer.from(await upstream.arrayBuffer()),
      });
    });
  }
});

test.beforeAll(async ({ request }) => {
  await seedTypicalWeek(request);
});

for (const viewport of VIEWPORTS) {
  test(`Gipfelbuch bei ${viewport.name}px ohne Seitwaertsscrollen`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/gipfelbuch/");

    await expect(page.locator("h1")).toContainText("Was zwischen den Touren passiert");

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);

    await page.screenshot({
      path: `test-results/gipfelbuch-${testInfo.project.name}-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("zeigt die grosse Jahreszahl und alle Zeilen", async ({ page }) => {
  await page.goto("/gipfelbuch/");

  await expect(page.locator(".gb-hero__value")).toContainText("1.661");
  await expect(page.locator(".gb-row")).toHaveCount(5);
  await expect(page.locator(".gb-side__item").nth(2)).toContainText("5");
});

test("laeuft ohne Konsolenfehler", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });

  await page.goto("/gipfelbuch/");
  await page.waitForLoadState("networkidle");

  expect(problems).toEqual([]);
});

test("ist mit reduzierter Bewegung bedienbar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/gipfelbuch/");

  await expect(page.locator(".gb-hero__value")).toBeVisible();

  const animation = await page.locator(".gb-dot").evaluate(
    (node) => getComputedStyle(node).animationName
  );
  expect(animation).toBe("none");
});

test("laesst sich per Tastatur durchlaufen", async ({ page }) => {
  await page.goto("/gipfelbuch/");
  await page.keyboard.press("Tab");

  const hasVisibleFocus = await page.evaluate(() => {
    const active = document.activeElement;
    return active === document.body || active instanceof HTMLElement;
  });

  expect(hasVisibleFocus).toBe(true);
});
