import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest 3.2 `test.projects` replaces the deprecated vitest.workspace.ts file.
// Each project is a workspace package; jsdom for component/hook tests, node for
// pure-logic tests. Per-package vitest.config.ts files are allowed but we keep
// the project definitions centralised here for now.
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
      "./packages/eslint-config",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
