import { expect, test } from "@playwright/test";

// Der Leerzustand ist das Erste, was am Tag eins zu sehen ist — er verdient
// eine eigene Sichtpruefung. Laeuft nicht in der Standardrunde, weil er eine
// leere Datenbank braucht und die Hauptsuite Daten anlegt:
//
//   npx wrangler d1 execute vh-portal --local --command "DELETE FROM activities"
//   VH_EMPTY_CHECK=1 npx playwright test e2e/leerzustand.spec.js --project=chromium
test.skip(!process.env.VH_EMPTY_CHECK, "nur mit VH_EMPTY_CHECK=1 und leerer Datenbank");

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

for (const width of [320, 1440]) {
  test(`Leerzustand bei ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/gipfelbuch/");

    await expect(page.locator(".gb-empty")).toBeVisible();
    await expect(page.locator(".gb-hero")).toHaveCount(0);

    await page.screenshot({
      path: `test-results/leerzustand-${testInfo.project.name}-${width}.png`,
      fullPage: true,
    });
  });
}
