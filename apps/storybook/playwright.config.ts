import { defineConfig, devices } from "@playwright/test";

const PORT = 6007;

export default defineConfig({
  testDir: "./tests",
  // Baselines live at tests/__snapshots__/<story-id>.png — no platform/project suffix.
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  expect: {
    // Flake mitigation defaults per ADR-009. Stricter/looser overrides go per-story.
    toHaveScreenshot: {
      // Absolute pixel cap (not a ratio): on a full-page 1280x720 canvas a ratio
      // would dilute small-component regressions (a ~9200px change still passes at
      // 0.01). Full-page capture is retained because portal/overlay primitives
      // (Dialog, Sheet, Popover) render outside #storybook-root.
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
    },
  ],
  // Serve the pre-built static Storybook. The test:visual script runs `storybook build`
  // before `playwright test`, so storybook-static/index.json exists at collection time.
  webServer: {
    command: `pnpm exec http-server storybook-static -p ${PORT} -c-1 --silent`,
    url: `http://localhost:${PORT}/index.json`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
