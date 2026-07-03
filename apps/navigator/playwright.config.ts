import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnvContent } from "./tests/e2e/parse-env-file";

// Load .env.test into process.env (values already in the environment take precedence).
// The file is optional so this is a no-op in CI where credentials come from CI secrets.
try {
  const content = readFileSync(new URL(".env.test", import.meta.url), "utf-8");
  for (const [key, value] of Object.entries(parseEnvContent(content))) {
    process.env[key] ??= value;
  }
} catch (err) {
  if ((err as { code?: string }).code !== "ENOENT") throw err;
}

// Firefox headless date-picker fix: https://github.com/microsoft/playwright/issues/7769
const firefoxPointerPrefs = {
  "ui.primaryPointerCapabilities": 0x02 | 0x04,
  "ui.allPointerCapabilities": 0x02 | 0x04,
};

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
        launchOptions: { firefoxUserPrefs: firefoxPointerPrefs },
      },
    },
    {
      name: "firefox-small",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 800, height: 600 },
        launchOptions: { firefoxUserPrefs: firefoxPointerPrefs },
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
