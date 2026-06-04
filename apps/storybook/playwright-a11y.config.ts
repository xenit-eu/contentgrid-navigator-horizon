import { defineConfig, devices } from "@playwright/test";

const PORT = 6009;

export default defineConfig({
  testDir: "./tests",
  testMatch: "accessibility.spec.ts",
  // Run serially to avoid axe "already running" conflicts: the @storybook/addon-a11y panel
  // bundles axe-core into the Storybook iframe and runs its own audit when a story loads.
  // Running multiple test workers in parallel causes two axe instances to collide inside the
  // same iframe process. Serial execution (workers=1) prevents this race condition.
  fullyParallel: false,
  workers: 1,
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
  // `pnpm test:a11y` builds Storybook first, then runs this config.
  webServer: {
    command: `pnpm exec http-server storybook-static -p ${PORT} -c-1 --silent`,
    url: `http://localhost:${PORT}/index.json`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
