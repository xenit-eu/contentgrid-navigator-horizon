import { describe, expect, it } from "vitest";
import { CONFIG_PRESETS, localDevPreset, stagingPreset } from "./presets";
import { appConfigSchema } from "./schema";

describe.each([
  { presetName: "local-dev", preset: localDevPreset, appNameFragment: "local-dev" },
  { presetName: "staging", preset: stagingPreset, appNameFragment: "staging" },
])("$presetName preset", ({ preset, appNameFragment }) => {
  it("is valid per appConfigSchema", () => {
    const result = appConfigSchema.safeParse(preset);
    expect(result.success).toBe(true);
  });

  it("has a themed appName", () => {
    expect(preset.branding.appName).toContain(appNameFragment);
  });
});

describe("CONFIG_PRESETS", () => {
  it("contains local-dev and staging keys", () => {
    expect(Object.keys(CONFIG_PRESETS)).toContain("local-dev");
    expect(Object.keys(CONFIG_PRESETS)).toContain("staging");
  });

  it("local-dev entry matches localDevPreset", () => {
    expect(CONFIG_PRESETS["local-dev"]).toBe(localDevPreset);
  });

  it("staging entry matches stagingPreset", () => {
    expect(CONFIG_PRESETS["staging"]).toBe(stagingPreset);
  });
});
