import type { ESLint } from "eslint";
import { rule as noRestrictedSources } from "./rules/no-restricted-sources.js";
import { rule as noUnstableViews } from "./rules/no-unstable-views.js";
import { rule as viewStabilityOrder } from "./rules/view-stability-order.js";

/**
 * The repo's own ESLint rules, registered under the `@contentgrid` namespace. One shared plugin
 * object: ESLint refuses two different objects under the same namespace, so every config that
 * uses a `@contentgrid/*` rule imports this one.
 */
export const contentgridPlugin = {
  rules: {
    "no-restricted-sources": noRestrictedSources,
    "no-unstable-views": noUnstableViews,
    "view-stability-order": viewStabilityOrder,
  },
} as unknown as ESLint.Plugin;
