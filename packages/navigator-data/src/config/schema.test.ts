import { describe, expect, it } from "vitest";
import { appConfigSchema, validateConfig } from "./schema";

describe("appConfigSchema", () => {
  it("parses a minimal valid config", () => {
    const result = appConfigSchema.safeParse({ version: 1 });
    expect(result.success).toBe(true);
  });

  it("parses a full valid config", () => {
    const config = {
      version: 1,
      branding: { appName: "My App", logoUrl: null, logoAlt: "Logo" },
      homePage: { welcomeTitle: "Hello", welcomeSubtitle: "World" },
      display: { defaultPageSize: 25 },
      theme: { colorPreset: "green" },
      featureFlags: { betaSearch: true, newUI: false },
    };
    const result = appConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects a config with wrong type for version", () => {
    const result = appConfigSchema.safeParse({ version: "1" });
    expect(result.success).toBe(false);
  });

  it("rejects a config with wrong type for defaultPageSize", () => {
    const result = appConfigSchema.safeParse({
      version: 1,
      display: { defaultPageSize: "twenty" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts featureFlags as a record of booleans", () => {
    const result = appConfigSchema.safeParse({
      version: 1,
      featureFlags: { alpha: true, beta: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects featureFlags with non-boolean values", () => {
    const result = appConfigSchema.safeParse({
      version: 1,
      featureFlags: { alpha: "yes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("validateConfig", () => {
  it("returns success: true for valid data", () => {
    const result = validateConfig({ version: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
    }
  });

  it("returns success: false with a prettified error string for invalid data", () => {
    const result = validateConfig({ version: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("returns success: false for non-object input", () => {
    const result = validateConfig(null);
    expect(result.success).toBe(false);
  });
});
