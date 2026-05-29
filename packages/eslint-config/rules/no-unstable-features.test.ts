import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { rule } from "./no-unstable-features.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
});

// Filename inside __fixtures__/fake-app so the rule resolves
// @contentgrid/features via __fixtures__/node_modules/ without touching
// the real packages/features/ package
const fixturesDir = new URL("./__fixtures__/fake-app/index.ts", import.meta.url).pathname;

tester.run("no-unstable-features", rule, {
  valid: [
    {
      name: "stable feature is allowed",
      code: 'import "@contentgrid/features/stable-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
    {
      name: "experimental feature is allowed when all tiers permitted",
      code: 'import "@contentgrid/features/experimental-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["experimental", "candidate", "stable"] }],
    },
    {
      name: "candidate feature is allowed when all tiers permitted",
      code: 'import "@contentgrid/features/candidate-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["experimental", "candidate", "stable"] }],
    },
    {
      name: "non-features imports are always ignored",
      code: 'import { Button } from "@contentgrid/ui";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
    },
  ],
  invalid: [
    {
      name: "experimental feature is blocked when only stable allowed",
      code: 'import "@contentgrid/features/experimental-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableFeature" }],
    },
    {
      name: "candidate feature is blocked when only stable allowed",
      code: 'import "@contentgrid/features/candidate-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "unstableFeature" }],
    },
    {
      name: "invalid x-stability value reports invalidStability not unstableFeature",
      code: 'import "@contentgrid/features/typo-feature";',
      filename: fixturesDir,
      options: [{ allowedStability: ["stable"] }],
      errors: [{ messageId: "invalidStability" }],
    },
  ],
});
