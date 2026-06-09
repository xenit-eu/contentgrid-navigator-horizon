import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./defaults";
import { CONFIG_PRESETS, localDevPreset, stagingPreset } from "./presets";
import { appConfigSchema } from "./schema";

describe("localDevPreset", () => {
  it("is valid per appConfigSchema", () => {
    const result = appConfigSchema.safeParse(localDevPreset);
    expect(result.success).toBe(true);
  });

  it("has a dev-flavoured appName", () => {
    expect(localDevPreset.branding.appName).toContain("local-dev");
  });

  it("differs from DEFAULT_CONFIG in branding.appName", () => {
    expect(localDevPreset.branding.appName).not.toBe(DEFAULT_CONFIG.branding.appName);
  });
});

describe("stagingPreset", () => {
  it("is valid per appConfigSchema", () => {
    const result = appConfigSchema.safeParse(stagingPreset);
    expect(result.success).toBe(true);
  });

  it("has a staging-flavoured appName", () => {
    expect(stagingPreset.branding.appName).toContain("staging");
  });

  it("differs from DEFAULT_CONFIG in branding.appName", () => {
    expect(stagingPreset.branding.appName).not.toBe(DEFAULT_CONFIG.branding.appName);
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
