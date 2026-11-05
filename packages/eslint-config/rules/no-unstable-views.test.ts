import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { rule } from "./no-unstable-views.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
});

// Filename inside __fixtures__/fake-app so the rule resolves
// @contentgrid/views via __fixtures__/node_modules/ without touching
// the real packages/views/ package
const fixturesDir = new URL("./__fixtures__/fake-app/index.ts", import.meta.url).pathname;

tester.run("no-unstable-views", rule, {
  valid: [
    {
      name: "stable view is allowed",
      code: 'import "@contentgrid/views/stable-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
    {
      name: "experimental view is allowed when all tiers permitted",
      code: 'import "@contentgrid/views/experimental-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["experimental", "candidate", "stable"] }],
    },
    {
      name: "candidate view is allowed when all tiers permitted",
      code: 'import "@contentgrid/views/candidate-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["experimental", "candidate", "stable"] }],
    },
    {
      name: "non-view imports are always ignored",
      code: 'import { Button } from "@contentgrid/ui";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
    {
      name: "feature imports are not stability-checked (the tag lives on views, features carry none)",
      code: 'import "@contentgrid/features/experimental-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
    {
      name: "the views root barrel has no tag and is ignored",
      code: 'import { NavigatorApp } from "@contentgrid/views";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
    {
      name: "export-from of a stable view is allowed",
      code: 'export { view } from "@contentgrid/views/stable-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
  ],
  invalid: [
    {
      name: "export { x } from an experimental view is blocked",
      code: 'export { view } from "@contentgrid/views/experimental-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableView" }],
    },
    {
      name: "export * from a candidate view is blocked",
      code: 'export * from "@contentgrid/views/candidate-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableView" }],
    },
    {
      name: "export-from a typo-tagged view reports invalidStability",
      code: 'export { view } from "@contentgrid/views/typo-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "invalidStability" }],
    },
    {
      name: "experimental view is blocked when only stable allowed",
      code: 'import "@contentgrid/views/experimental-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableView" }],
    },
    {
      name: "candidate view is blocked when only stable allowed",
      code: 'import "@contentgrid/views/candidate-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableView" }],
    },
    {
      name: "invalid x-stability value reports invalidStability not unstableView",
      code: 'import "@contentgrid/views/typo-view";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "invalidStability" }],
    },
  ],
});
