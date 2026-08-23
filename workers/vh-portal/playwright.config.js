import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: "npx wrangler dev --port 8787 --local",
    url: "http://127.0.0.1:8787/gipfelbuch/api/health",
    reuseExistingServer: true,
    timeout: 90000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
