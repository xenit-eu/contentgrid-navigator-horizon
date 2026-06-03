import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: process.env.CI ? 120_000 : 30_000,
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 5,
  maxFailures: 4,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium-large",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "chromium-small",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 800, height: 600 },
      },
    },
    {
      name: "firefox-large",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          /*
           * Firefox does not render the date picker properly in headless mode (known issue).
           * Force pointer precision via browser preferences:
           * https://github.com/microsoft/playwright/issues/7769
           */
          firefoxUserPrefs: {
            "ui.primaryPointerCapabilities": 0x02 | 0x04,
            "ui.allPointerCapabilities": 0x02 | 0x04,
          },
        },
      },
    },
    {
      name: "firefox-small",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 800, height: 600 },
        launchOptions: {
          firefoxUserPrefs: {
            "ui.primaryPointerCapabilities": 0x02 | 0x04,
            "ui.allPointerCapabilities": 0x02 | 0x04,
          },
        },
      },
    },
  ],

  webServer: {
    command: "pnpm --filter navigator dev",
    url: "http://localhost:5173",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
