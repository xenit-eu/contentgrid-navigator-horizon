import { ESLint, type Linter } from "eslint";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import {
  appsViewsOnly,
  featuresLayerConfig,
  navigatorDataLayerConfig,
  restrictSources,
  uiLayerConfig,
  viewsLayerConfig,
} from "./layers.js";
import { contentgridPlugin } from "./plugin.js";

/**
 * One fixture file per case under __fixtures__/layers/<layer>/src/: `fail-*` must produce the
 * expected rule error, `pass-*` must lint clean. Each layer is linted with the very config
 * factory its package's eslint.config.js uses, with the layer directory as the cwd (the same
 * relationship a real package has to its own config).
 */

const layersDir = fileURLToPath(new URL("./rules/__fixtures__/layers/", import.meta.url));

const parseTs: Linter.Config = {
  files: ["**/*.ts"],
  languageOptions: { parser: tseslint.parser },
};

async function lint(layer: string, config: Linter.Config[], file: string) {
  const cwd = join(layersDir, layer);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [parseTs, ...config],
  });
  const filePath = join(cwd, "src", file);
  const [result] = await eslint.lintText(readFileSync(filePath, "utf-8"), { filePath });
  return result.messages;
}

const restricted = (layerTag: string) => ({
  ruleId: "@contentgrid/no-restricted-sources",
  message: expect.stringContaining(layerTag),
});

describe("L1 apps import features only through views", () => {
  // The apps' own configs pass their allowlist; the fixture app allows only `search`.
  const config: Linter.Config[] = [
    {
      plugins: { "@contentgrid": contentgridPlugin },
      rules: restrictSources(appsViewsOnly(["search"])),
    },
  ];
  it.each([
    ["a direct feature import", "fail-L1-feature-import.ts"],
    ["the features barrel", "fail-L1-feature-barrel.ts"],
    ["a relative path into packages/features", "fail-L1-relative.ts"],
    ["a dynamic import()", "fail-L1-dynamic.ts"],
    ["a typeof import()", "fail-L1-typeof-import.ts"],
    ["an export ... from", "fail-L1-export-from.ts"],
  ])("fails on %s", async (_name, file) => {
    expect(await lint("apps", config, file)).toEqual([expect.objectContaining(restricted("L1:"))]);
  });
  it.each([
    ["view, navigator-data and router imports", "pass-L1-view-import.ts"],
    ["a feature on the pending-view allowlist", "pass-L1-pending-feature.ts"],
    ["a relative path to an allowlisted feature", "pass-L1-pending-relative.ts"],
    ["dynamic and typeof imports of a view", "pass-L1-dynamic-view.ts"],
    ["a relative import of the app's own file", "pass-L1-own-relative.ts"],
  ])("passes on %s", async (_name, file) => {
    expect(await lint("apps", config, file)).toEqual([]);
  });
  it("with an empty allowlist, even `search` is rejected", async () => {
    const empty: Linter.Config[] = [
      { plugins: { "@contentgrid": contentgridPlugin }, rules: restrictSources(appsViewsOnly([])) },
    ];
    expect(await lint("apps", empty, "pass-L1-pending-feature.ts")).toEqual([
      expect.objectContaining(restricted("L1:")),
    ]);
  });
});

describe("L2 features and views never import the router", () => {
  const featureRouterExempt = ["src/exempt-*.ts"];
  it("features: fails on a router import", async () => {
    expect(await lint("features", featuresLayerConfig(), "fail-L2-router.ts")).toEqual([
      expect.objectContaining(restricted("L2:")),
    ]);
  });
  it("features: passes without one", async () => {
    expect(await lint("features", featuresLayerConfig(), "pass-L2-no-router.ts")).toEqual([]);
  });
  it("features: a listed exemption may import the router but still obeys L4", async () => {
    const config = featuresLayerConfig(featureRouterExempt);
    expect(await lint("features", config, "exempt-L2-router.ts")).toEqual([]);
    expect(await lint("features", config, "exempt-fail-L4-views.ts")).toEqual([
      expect.objectContaining(restricted("L4:")),
    ]);
  });
  it("views: fails on a router import outside shells", async () => {
    expect(await lint("views", viewsLayerConfig(), "fail-L2-router.ts")).toEqual([
      expect.objectContaining(restricted("L2:")),
    ]);
  });
  it.each(["fail-L2-router-dynamic.ts", "fail-L2-router-devtools.ts"])(
    "views: fails on %s",
    async (file) => {
      // The fixture has two violations: an import() and a typeof import().
      expect(await lint("views", viewsLayerConfig(), file)).toEqual(
        Array.from({ length: file.includes("dynamic") ? 2 : 1 }, () =>
          expect.objectContaining(restricted("L2:")),
        ),
      );
    },
  );
  it.each(["fail-L2-router-dynamic.ts", "fail-L2-router-devtools.ts"])(
    "features: fails on %s",
    async (file) => {
      // The fixture has two violations: an import() and a typeof import().
      expect(await lint("features", featuresLayerConfig(), file)).toEqual(
        Array.from({ length: file.includes("dynamic") ? 2 : 1 }, () =>
          expect.objectContaining(restricted("L2:")),
        ),
      );
    },
  );
  it("views: passes without one", async () => {
    expect(await lint("views", viewsLayerConfig(), "pass-L2-no-router.ts")).toEqual([]);
  });
  it("views: shells (router setup host code) may import the router", async () => {
    expect(await lint("views", viewsLayerConfig(), "shells/pass-L2-router-in-shells.ts")).toEqual(
      [],
    );
  });
});

describe("L3 the UI package never imports features", () => {
  it("fails on a feature import", async () => {
    expect(await lint("ui", uiLayerConfig(), "fail-L3-features.ts")).toEqual([
      expect.objectContaining(restricted("L3:")),
    ]);
  });
  it.each(["fail-L3-features-relative.ts", "fail-L3-features-dynamic.ts"])(
    "fails on %s",
    async (file) => {
      expect(await lint("ui", uiLayerConfig(), file)).toEqual([
        expect.objectContaining(restricted("L3:")),
        ...(file.includes("dynamic") ? [expect.objectContaining(restricted("L3:"))] : []),
      ]);
    },
  );
  it.each(["pass-L3-no-features.ts", "pass-L3-own-relative.ts"])("passes on %s", async (file) => {
    expect(await lint("ui", uiLayerConfig(), file)).toEqual([]);
  });
});

describe("L4 features, ui and navigator-data never import views", () => {
  it.each([
    ["features", featuresLayerConfig()],
    ["ui", uiLayerConfig()],
    ["navigator-data", navigatorDataLayerConfig()],
  ])("%s: fails on a views import", async (layer, config) => {
    expect(await lint(layer, config, "fail-L4-views.ts")).toEqual([
      expect.objectContaining(restricted("L4:")),
    ]);
  });
  it.each([
    ["features", featuresLayerConfig()],
    ["ui", uiLayerConfig()],
    ["navigator-data", navigatorDataLayerConfig()],
  ])("%s: fails on relative, dynamic, typeof import() and export-from", async (layer, config) => {
    for (const file of [
      "fail-L4-views-relative.ts",
      "fail-L4-views-dynamic.ts",
      "fail-L4-views-typeof-import.ts",
      "fail-L4-views-export-from.ts",
    ]) {
      expect(await lint(layer, config, file), `${layer}/${file}`).toEqual([
        expect.objectContaining(restricted("L4:")),
      ]);
    }
  });
  it.each([
    ["features", featuresLayerConfig()],
    ["ui", uiLayerConfig()],
    ["navigator-data", navigatorDataLayerConfig()],
  ])("%s: passes without one", async (layer, config) => {
    expect(await lint(layer, config, "pass-L4-no-views.ts")).toEqual([]);
  });
  it("features: a relative import inside the package is not a views import", async () => {
    expect(await lint("features", featuresLayerConfig(), "pass-L4-own-relative.ts")).toEqual([]);
  });
});

describe("L5 stable views never import experimental views", () => {
  const config = viewsLayerConfig();
  const lessStable = { ruleId: "@contentgrid/view-stability-order" };
  it("fails: stable imports experimental", async () => {
    expect(await lint("views", config, "stable-view/fail-L5-imports-experimental.ts")).toEqual([
      expect.objectContaining(lessStable),
    ]);
  });
  it("fails: stable imports candidate", async () => {
    expect(await lint("views", config, "stable-view/fail-L5-imports-candidate.ts")).toEqual([
      expect.objectContaining(lessStable),
    ]);
  });
  it("fails: stable re-exports experimental", async () => {
    expect(await lint("views", config, "stable-view/fail-L5-reexports-experimental.ts")).toEqual([
      expect.objectContaining(lessStable),
    ]);
  });
  it("fails: candidate imports experimental", async () => {
    expect(await lint("views", config, "candidate-view/fail-L5-imports-experimental.ts")).toEqual([
      expect.objectContaining(lessStable),
    ]);
  });
  it("fails: stable re-exports experimental through a dynamic import()", async () => {
    expect(
      await lint("views", config, "stable-view/fail-L5-dynamic-imports-experimental.ts"),
    ).toEqual([expect.objectContaining(lessStable)]);
  });
  it("fails: untagged support code (treated as stable) imports experimental", async () => {
    expect(await lint("views", config, "support/fail-L5-untagged-imports-experimental.ts")).toEqual(
      [expect.objectContaining(lessStable)],
    );
  });
  it("fails: the untagged root barrel re-exports experimental", async () => {
    expect(await lint("views", config, "fail-L5-root-barrel-reexports-experimental.ts")).toEqual([
      expect.objectContaining(lessStable),
    ]);
  });
  it("passes: the untagged root barrel re-exports stable views and support code", async () => {
    expect(await lint("views", config, "pass-L5-root-barrel-reexports-stable.ts")).toEqual([]);
  });
  it("passes: stable imports stable and untagged support code", async () => {
    expect(
      await lint("views", config, "stable-view/pass-L5-imports-stable-and-untagged.ts"),
    ).toEqual([]);
  });
  it("passes: experimental imports more stable views", async () => {
    expect(await lint("views", config, "experimental-view/pass-L5-imports-stable.ts")).toEqual([]);
  });
});
