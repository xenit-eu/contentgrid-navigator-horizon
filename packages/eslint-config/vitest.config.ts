import { defineConfig } from "vitest/config";

// Self-contained config so `pnpm --filter @contentgrid/eslint-config test` runs only this package's node-environment tests; referenced from the root vitest.config.ts projects list.
export default defineConfig({
  test: {
    name: "eslint-config",
    environment: "node",
  },
});
