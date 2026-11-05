import { ESLint, type Linter } from "eslint";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import {
  appsLayerConfig,
  featuresLayerConfig,
  navigatorDataLayerConfig,
  uiLayerConfig,
  viewsLayerConfig,
} from "./layers.js";

/**
 * One fixture file per case under __fixtures__/layers/<layer>/src/: `fail-*` must produce the
 * expected rule error, `pass-*` must lint clean. Each layer is linted with the very config
 * factory its package's eslint.config.js uses, with the layer directory as the cwd (the same
 * relationship a real package has to its own config).
 */

const layersDir = fileURLToPath(new URL("./__fixtures__/layers/", import.meta.url));

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
  ruleId: "no-restricted-imports",
  message: expect.stringContaining(layerTag),
});

describe("L1 apps import features only through views", () => {
  const config = appsLayerConfig();
  it("fails on a direct feature import", async () => {
    expect(await lint("apps", config, "fail-L1-feature-import.ts")).toEqual([
      expect.objectContaining(restricted("L1:")),
    ]);
  });
  it("fails on the features barrel", async () => {
    expect(await lint("apps", config, "fail-L1-feature-barrel.ts")).toEqual([
      expect.objectContaining({ ruleId: "no-restricted-imports" }),
    ]);
  });
  it("passes on view, navigator-data and router imports", async () => {
    expect(await lint("apps", config, "pass-L1-view-import.ts")).toEqual([]);
  });
  it("passes on a feature that has no view yet (transitional allowlist)", async () => {
    expect(await lint("apps", config, "pass-L1-pending-feature.ts")).toEqual([]);
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
  it("passes without one", async () => {
    expect(await lint("ui", uiLayerConfig(), "pass-L3-no-features.ts")).toEqual([]);
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
  ])("%s: passes without one", async (layer, config) => {
    expect(await lint(layer, config, "pass-L4-no-views.ts")).toEqual([]);
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
  it("passes: stable imports stable and untagged support code", async () => {
    expect(
      await lint("views", config, "stable-view/pass-L5-imports-stable-and-untagged.ts"),
    ).toEqual([]);
  });
  it("passes: experimental imports more stable views", async () => {
    expect(await lint("views", config, "experimental-view/pass-L5-imports-stable.ts")).toEqual([]);
  });
});
