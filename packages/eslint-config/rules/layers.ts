import type { Linter, Rule } from "eslint";
import { rule as viewStabilityOrder } from "./view-stability-order.js";

/**
 * Layer import rules L1-L5 (specs/005-views-layer/contracts/layer-lint-rules.md, FR-034).
 *
 *   apps  ->  views  ->  features  ->  ui  (navigator-data is usable by every layer above ui)
 *
 * L1-L4 use ESLint core's `no-restricted-imports`; L5 is the repo's own
 * `view-stability-order` rule (it needs the importing view's tag, which a pattern cannot read).
 * Each factory below returns flat-config entries for ONE package/app; spread it into that
 * package's `eslint.config.js` after the base config. Paths in `ignores` are relative to the
 * package directory, like the rest of that config.
 *
 * Note: ESLint replaces (never merges) a rule's options between config entries, so a package
 * that adds its own `no-restricted-imports` patterns must build one list from the exported
 * pattern groups rather than adding a second entry for the same files.
 */

type Pattern = { group: string[]; message: string };
type Path = { name: string; message: string };

const ROUTER_PATTERN: Pattern = {
  group: [
    "@tanstack/react-router",
    "@tanstack/react-router/*",
    "@tanstack/router-*",
    "@tanstack/history",
  ],
  message:
    "L2: only apps/* and the router-setup host code in packages/views/src/shells/ may import the router. Views reach navigation through useViewNavigation(); features report actions through callback props.",
};

const VIEWS_PATTERN = (layer: string): Pattern => ({
  group: ["@contentgrid/views", "@contentgrid/views/*", "**/packages/views/**"],
  message: `L4: ${layer} must not import packages/views — each layer imports only from the layers below it.`,
});

const UI_FEATURES_PATTERN: Pattern = {
  group: ["@contentgrid/features", "@contentgrid/features/*", "**/packages/features/**"],
  message: "L3: the UI package must not import features.",
};

/**
 * Features the apps still import directly because no view wraps them yet (pages not yet
 * migrated into views: create-item, entity configuration, the search-URL helpers and the
 * loading page). Transitional, and the only exception to L1: delete an entry when its view
 * lands. A new entry needs a spec amendment (contracts/layer-lint-rules.md, L1).
 */
export const APPS_FEATURE_IMPORTS_PENDING_VIEW = [
  "app-info-pages",
  "entity-item-create",
  "preferences",
  "search",
] as const;

// The barrel is an exact-match `paths` entry: as a pattern it would also match every subpath
// and gitignore-style negations cannot re-include a child of an excluded parent.
const appsViaViewsBarrel: Path = {
  name: "@contentgrid/features",
  message: "L1: apps import features only through views (@contentgrid/views/<view>).",
};

const appsViaViewsPattern: Pattern = {
  group: [
    "@contentgrid/features/*",
    ...APPS_FEATURE_IMPORTS_PENDING_VIEW.map((name) => `!@contentgrid/features/${name}`),
  ],
  message:
    "L1: apps import features only through views (@contentgrid/views/<view>). A feature with no view yet must be listed in APPS_FEATURE_IMPORTS_PENDING_VIEW.",
};

export const layerPatterns = {
  /** L1 — apps */
  appsViaViews: appsViaViewsPattern,
  /** L2 — features and views */
  noRouter: ROUTER_PATTERN,
  /** L3 — ui */
  uiNoFeatures: UI_FEATURES_PATTERN,
  /** L4 — features, ui, navigator-data */
  noViews: VIEWS_PATTERN,
} as const;

export function restrictImports(patterns: Pattern[], paths: Path[] = []): Linter.RulesRecord {
  return { "no-restricted-imports": ["error", { patterns, paths }] };
}

/**
 * L1. `extra` carries the app's own non-layer patterns (e.g. the local-mock-backend rule) and
 * `extraExempt` the files those extra patterns do not apply to; L1 applies to every file.
 */
export function appsLayerConfig(
  extra: Pattern[] = [],
  extraExempt: string[] = [],
): Linter.Config[] {
  const l1 = [layerPatterns.appsViaViews];
  const paths = [appsViaViewsBarrel];
  if (extra.length === 0 || extraExempt.length === 0) {
    return [{ name: "contentgrid/layers/apps", rules: restrictImports([...l1, ...extra], paths) }];
  }
  return [
    {
      name: "contentgrid/layers/apps",
      ignores: extraExempt,
      rules: restrictImports([...l1, ...extra], paths),
    },
    {
      name: "contentgrid/layers/apps/extra-exempt",
      files: extraExempt,
      rules: restrictImports(l1, paths),
    },
  ];
}

/** L2 (router; shells exempt) + L5 (stable views never import experimental ones). */
export function viewsLayerConfig(): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/views",
      ignores: ["src/shells/**"],
      rules: restrictImports([layerPatterns.noRouter]),
    },
    {
      name: "contentgrid/layers/views/stability-order",
      plugins: {
        "@contentgrid": {
          rules: { "view-stability-order": viewStabilityOrder as unknown as Rule.RuleModule },
        },
      },
      rules: { "@contentgrid/view-stability-order": "error" },
    },
  ];
}

/** L2 + L4. `routerExemptFiles` lists the files that may still import the router (see features' config). */
export function featuresLayerConfig(routerExemptFiles: string[] = []): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/features",
      ...(routerExemptFiles.length ? { ignores: routerExemptFiles } : {}),
      rules: restrictImports([layerPatterns.noRouter, layerPatterns.noViews("features")]),
    },
    ...(routerExemptFiles.length
      ? [
          {
            name: "contentgrid/layers/features/router-exempt",
            files: routerExemptFiles,
            rules: restrictImports([layerPatterns.noViews("features")]),
          } satisfies Linter.Config,
        ]
      : []),
  ];
}

/** L3 + L4. */
export function uiLayerConfig(): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/ui",
      rules: restrictImports([layerPatterns.uiNoFeatures, layerPatterns.noViews("the UI package")]),
    },
  ];
}

/** L4. */
export function navigatorDataLayerConfig(): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/navigator-data",
      rules: restrictImports([layerPatterns.noViews("navigator-data")]),
    },
  ];
}
