import { defineConfig, devices } from "@playwright/test";

// Eigene D1-Ablage fuer die E2E, damit sie nicht gegen die Entwicklungs-
// Datenbank laufen. global-setup.js legt sie an und raeumt sie leer.
const E2E_STATE_DIR = ".wrangler/e2e-state";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.js",
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: `npx wrangler dev --port 8787 --local --persist-to ${E2E_STATE_DIR}`,
    url: "http://127.0.0.1:8787/gipfelbuch/api/health",
    reuseExistingServer: false,
    timeout: 90000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
