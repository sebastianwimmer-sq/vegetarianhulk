import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

const migrations = await readD1Migrations("./migrations");

export default defineWorkersConfig({
  test: {
    // e2e/ gehoert Playwright. Ohne diese Grenze sammelt Vitest die Specs mit
    // ein, scheitert an deren @playwright/test-Import und meldet rote Dateien
    // bei gruenen Tests — ein Dauerfehlalarm.
    include: ["test/**/*.test.js"],
    setupFiles: ["./test/setup.js"],
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            LOG_SECRET: "test-log-secret-0123456789",
          },
        },
      },
    },
  },
});
