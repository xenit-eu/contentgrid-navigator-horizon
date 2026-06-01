import { defineConfig } from "vitest/config";

// Self-contained config so `pnpm --filter @contentgrid/eslint-config test`
// (and CI's per-app dependency-graph test step) runs ONLY this package's
// node-environment rule tests, instead of walking up to the root projects
// config. Referenced by path from the root vitest.config.ts projects list.
export default defineConfig({
  test: {
    name: "eslint-config",
    environment: "node",
  },
});
