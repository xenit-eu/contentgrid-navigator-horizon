import { defineConfig, devices } from "@playwright/test";

const PORT = 6008;

export default defineConfig({
  testDir: "./tests",
  testMatch: "interaction.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Re-use the same pre-built static Storybook.
  // `pnpm test:storybook` builds Storybook first, then runs this config.
  webServer: {
    command: `pnpm exec http-server storybook-static -p ${PORT} -c-1 --silent`,
    url: `http://localhost:${PORT}/index.json`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
