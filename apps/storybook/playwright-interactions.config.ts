import { makeStorybookPlaywrightConfig } from "./playwright.shared";

// `pnpm test:storybook` builds Storybook first, then runs this config.
export default makeStorybookPlaywrightConfig({
  port: 6008,
  testMatch: "interaction.spec.ts",
});
