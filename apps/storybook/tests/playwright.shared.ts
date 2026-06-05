import { type PlaywrightTestConfig, defineConfig, devices } from "@playwright/test";

/**
 * Shared Playwright config factory for the Storybook test suites that drive a
 * pre-built static Storybook over http-server (interaction + accessibility).
 *
 * Each suite runs on its own port so they can execute concurrently without
 * fighting over a single http-server instance. The corresponding
 * `pnpm test:*` script builds Storybook first, so `storybook-static/index.json`
 * exists at collection time.
 *
 * The visual-regression suite (`playwright.config.ts`) intentionally does NOT
 * use this factory: it needs extra screenshot-specific config
 * (`snapshotPathTemplate`, `expect.toHaveScreenshot`, `deviceScaleFactor`) and
 * runs fully parallel, so sharing would add more branching than it removes.
 */
export interface StorybookPlaywrightOptions {
  /** Dedicated port for this suite's http-server instance. */
  port: number;
  /** Which spec file(s) this config runs. */
  testMatch: string;
  /** Override the default worker count (e.g. 1 to serialise). */
  workers?: PlaywrightTestConfig["workers"];
}

export function makeStorybookPlaywrightConfig({
  port,
  testMatch,
  workers,
}: StorybookPlaywrightOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir: "./tests",
    testMatch,
    fullyParallel: false,
    ...(workers !== undefined ? { workers } : {}),
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
    use: {
      baseURL: `http://localhost:${port}`,
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
    // Serve the pre-built static Storybook. The corresponding `pnpm test:*`
    // script builds Storybook first, so storybook-static/index.json exists.
    webServer: {
      command: `pnpm exec http-server storybook-static -p ${port} -c-1 --silent`,
      url: `http://localhost:${port}/index.json`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  });
}
