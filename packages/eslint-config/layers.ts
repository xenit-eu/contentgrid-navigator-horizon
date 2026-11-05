import type { Linter } from "eslint";
import { contentgridPlugin } from "./plugin.js";
import type { Restriction } from "./rules/no-restricted-sources.js";

/**
 * Layer import rules L1-L5 (specs/005-views-layer/contracts/layer-lint-rules.md, FR-034).
 *
 *   apps  ->  views  ->  features  ->  ui  (navigator-data is usable by every layer above ui)
 *
 * L1-L4 are the repo's `no-restricted-sources` rule (it also sees dynamic imports, `import()`
 * types, `export ... from` and relative paths into another package, which core
 * `no-restricted-imports` does not); L5 is `view-stability-order` (it needs the importing view's
 * tag, which a pattern cannot read). Each factory returns flat-config entries for ONE
 * package/app; spread it into that package's `eslint.config.js` after the base config. Paths in
 * `ignores` are relative to the package directory, like the rest of that config.
 *
 * ESLint replaces (never merges) a rule's options between config entries, so a package that adds
 * its own restrictions must build one list (see `appsViewsOnly` and `restrictSources`) rather
 * than adding a second entry for the same files.
 */

// Relative paths are matched on the path they resolve to, so a file never matches a restriction
// on its own package. `views/src` also covers `packages/views` checked out under another name.
const PACKAGE_VIEWS = String.raw`(^|/)(packages/views|views/src)(/|$)`;
const PACKAGE_FEATURES = String.raw`(^|/)(packages/features|features/src)(/|$)`;

const noRouter: Restriction = {
  specifier: String.raw`^@tanstack/(react-router[^/]*|router-[^/]*|history)(/|$)`,
  message:
    "L2: only apps/* and the router-setup host code in packages/views/src/shells/ may import the router. Views reach navigation through useViewNavigation(); features report actions through callback props.",
};

const noViews = (layer: string): Restriction => ({
  specifier: String.raw`^@contentgrid/views(/|$)`,
  resolved: PACKAGE_VIEWS,
  message: `L4: ${layer} must not import packages/views — each layer imports only from the layers below it.`,
});

const uiNoFeatures: Restriction = {
  specifier: String.raw`^@contentgrid/features(/|$)`,
  resolved: PACKAGE_FEATURES,
  message: "L3: the UI package must not import features.",
};

/**
 * L1 restrictions for an app: features only through views. `pendingViewFeatures` lists the
 * features that have no view yet and may still be imported directly (a transitional allowlist the
 * app owns, in its own eslint config).
 */
export function appsViewsOnly(pendingViewFeatures: readonly string[]): Restriction[] {
  const allowed = pendingViewFeatures.length ? `(?:${pendingViewFeatures.join("|")})` : "(?!)";
  const message =
    "L1: apps import features only through views (@contentgrid/views/<view>). A feature with no view yet must be on the app's pending-view allowlist.";
  return [
    {
      specifier: String.raw`^@contentgrid/features$|^@contentgrid/features/(?!${allowed}(/|$))`,
      resolved: String.raw`(^|/)packages/features(/|$)(?!src/${allowed}(/|$))`,
      message,
    },
  ];
}

/** One `no-restricted-sources` rules record; use it to build an app's merged entry. */
export function restrictSources(restrictions: Restriction[]): Linter.RulesRecord {
  return { "@contentgrid/no-restricted-sources": ["error", { restrictions }] };
}

const plugins = { "@contentgrid": contentgridPlugin };

/** L2 (router; shells exempt) + L5 (a view never imports a less stable view). */
export function viewsLayerConfig(): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/views",
      plugins,
      ignores: ["src/shells/**"],
      rules: restrictSources([noRouter]),
    },
    {
      name: "contentgrid/layers/views/stability-order",
      plugins,
      rules: { "@contentgrid/view-stability-order": "error" },
    },
  ];
}

/** L2 + L4. `routerExemptFiles` lists the files that may still import the router (see features' config). */
export function featuresLayerConfig(routerExemptFiles: string[] = []): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/features",
      plugins,
      ...(routerExemptFiles.length ? { ignores: routerExemptFiles } : {}),
      rules: restrictSources([noRouter, noViews("features")]),
    },
    ...(routerExemptFiles.length
      ? [
          {
            name: "contentgrid/layers/features/router-exempt",
            plugins,
            files: routerExemptFiles,
            rules: restrictSources([noViews("features")]),
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
      plugins,
      rules: restrictSources([uiNoFeatures, noViews("the UI package")]),
    },
  ];
}

/** L4. */
export function navigatorDataLayerConfig(): Linter.Config[] {
  return [
    {
      name: "contentgrid/layers/navigator-data",
      plugins,
      rules: restrictSources([noViews("navigator-data")]),
    },
  ];
}
