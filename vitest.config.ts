import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// Centralised Vitest 3.2 `test.projects` config (replaces deprecated vitest.workspace.ts); jsdom for component/hook tests, node for pure logic.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "ui",
          root: "./packages/ui",
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "features",
          root: "./packages/features",
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "navigator-data",
          root: "./packages/navigator-data",
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "navigator",
          root: "./apps/navigator",
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
          exclude: [...configDefaults.exclude, "tests/**"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "navigator-experimental",
          root: "./apps/navigator-experimental",
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
        },
      },
      {
        test: {
          name: "navigator-e2e-utils",
          root: "./apps/navigator",
          environment: "node",
          include: ["tests/e2e/parse-env-file.test.ts"],
        },
      },
      "./packages/eslint-config",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 40,
        branches: 40,
        functions: 40,
        statements: 40,
      },
      exclude: ["**/*.stories.tsx", "**/*.config.ts", "**/generated/**", "**/test-fixtures/**"],
    },
  },
});
