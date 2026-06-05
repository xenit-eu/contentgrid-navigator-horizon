import { makeStorybookPlaywrightConfig } from "./playwright.shared";

// `pnpm test:a11y` builds Storybook first, then runs this config.
//
// workers:1 (serial) avoids axe "already running" conflicts: the
// @storybook/addon-a11y panel bundles axe-core into the Storybook iframe and
// runs its own audit when a story loads. Running multiple test workers in
// parallel causes two axe instances to collide inside the same iframe process.
export default makeStorybookPlaywrightConfig({
  port: 6009,
  testMatch: "accessibility.spec.ts",
  workers: 1,
});
