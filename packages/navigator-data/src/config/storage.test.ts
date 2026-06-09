import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./defaults";
import { clearConfig, configStorageKey, deepMerge, loadConfig, saveConfig } from "./storage";

afterEach(() => {
  localStorage.clear();
});

describe("configStorageKey", () => {
  it("returns a key with the expected format", () => {
    expect(configStorageKey("https://app.example.com")).toBe(
      "contentgrid-navigator-config:https://app.example.com",
    );
  });

  it("produces different keys for different appIds", () => {
    expect(configStorageKey("app-a")).not.toBe(configStorageKey("app-b"));
  });
});

describe("loadConfig", () => {
  it("returns DEFAULT_CONFIG when storage is empty", () => {
    const result = loadConfig("test-key");
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("returns DEFAULT_CONFIG when storage contains corrupt JSON", () => {
    localStorage.setItem("test-key", "{{invalid json}}");
    const result = loadConfig("test-key");
    expect(result).toEqual(DEFAULT_CONFIG);
  });
});

describe("saveConfig + loadConfig round-trip", () => {
  it("round-trips a config through the given key", () => {
    const key = "contentgrid-navigator-config:https://myapp.example.com";
    const config = {
      ...DEFAULT_CONFIG,
      branding: { ...DEFAULT_CONFIG.branding, appName: "Round-trip App" },
    };
    saveConfig(key, config);
    const loaded = loadConfig(key);
    expect(loaded.branding.appName).toBe("Round-trip App");
  });

  it("two different keys do not collide", () => {
    const keyA = configStorageKey("app-a");
    const keyB = configStorageKey("app-b");
    saveConfig(keyA, {
      ...DEFAULT_CONFIG,
      branding: { ...DEFAULT_CONFIG.branding, appName: "App A" },
    });
    saveConfig(keyB, {
      ...DEFAULT_CONFIG,
      branding: { ...DEFAULT_CONFIG.branding, appName: "App B" },
    });
    expect(loadConfig(keyA).branding.appName).toBe("App A");
    expect(loadConfig(keyB).branding.appName).toBe("App B");
  });
});

describe("clearConfig", () => {
  it("removes the config so loadConfig returns DEFAULT_CONFIG", () => {
    const key = configStorageKey("clear-test");
    saveConfig(key, {
      ...DEFAULT_CONFIG,
      branding: { ...DEFAULT_CONFIG.branding, appName: "Temp" },
    });
    clearConfig(key);
    expect(loadConfig(key)).toEqual(DEFAULT_CONFIG);
  });
});

describe("deepMerge", () => {
  it("merges nested objects", () => {
    const target = { a: { b: 1, c: 2 } };
    const source = { a: { b: 99 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { b: 99, c: 2 } });
  });

  it("replaces arrays instead of merging", () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [4, 5] };
    const result = deepMerge(target, source);
    expect(result.items).toEqual([4, 5]);
  });

  it("does not mutate the target", () => {
    const target = { a: { b: 1 } };
    const source = { a: { b: 2 } };
    deepMerge(target, source);
    expect(target.a.b).toBe(1);
  });

  it("adds top-level keys from source not present in target", () => {
    const target = { a: 1 } as Record<string, unknown>;
    const source = { b: 2 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("skips undefined source values", () => {
    const target = { a: 1 };
    const source = { a: undefined };
    const result = deepMerge(target, source);
    expect(result.a).toBe(1);
  });
});
