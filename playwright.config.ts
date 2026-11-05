import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL points the run at a server started separately (own DATA_DIR); no dev server is spawned then
const externalServer = process.env.E2E_BASE_URL;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // `open: never` — иначе после прогона поднимается сервер отчёта и терминал не отдаёт управление
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: externalServer ?? "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  webServer: externalServer
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
