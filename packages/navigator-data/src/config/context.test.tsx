import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppConfigProvider, useAppConfig } from "./context";
import { DEFAULT_CONFIG } from "./defaults";
import { configStorageKey } from "./storage";

const TEST_APP_ID = "https://test.example.com";
const TEST_KEY = configStorageKey(TEST_APP_ID);

afterEach(() => {
  localStorage.clear();
});

function makeWrapper(appId?: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AppConfigProvider appId={appId}>{children}</AppConfigProvider>;
  };
}

describe("useAppConfig", () => {
  it("throws if used outside AppConfigProvider", () => {
    // suppress expected error output
    const { result } = renderHook(() => {
      try {
        return useAppConfig();
      } catch (e) {
        return e as Error;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toMatch(/AppConfigProvider/);
  });

  it("returns DEFAULT_CONFIG on first render", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it("updateConfig merges a partial update into the config", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    act(() => {
      result.current.updateConfig({ branding: { appName: "Updated App" } });
    });

    expect(result.current.config.branding.appName).toBe("Updated App");
    // Other fields should be unchanged
    expect(result.current.config.branding.logoUrl).toBe(DEFAULT_CONFIG.branding.logoUrl);
  });

  it("updateConfig persists to localStorage under the app-identity key", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    act(() => {
      result.current.updateConfig({ branding: { appName: "Persisted" } });
    });

    const stored = JSON.parse(localStorage.getItem(TEST_KEY) ?? "{}") as {
      branding?: { appName?: string };
    };
    expect(stored.branding?.appName).toBe("Persisted");
  });

  it("resetConfig clears localStorage and restores DEFAULT_CONFIG", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    act(() => {
      result.current.updateConfig({ branding: { appName: "Temp" } });
    });
    act(() => {
      result.current.resetConfig();
    });

    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    // After reset, the persist effect immediately re-writes DEFAULT_CONFIG back.
    // The storage value should be DEFAULT_CONFIG (not the old "Temp" value).
    const stored = JSON.parse(localStorage.getItem(TEST_KEY) ?? "null") as
      | typeof DEFAULT_CONFIG
      | null;
    expect(stored?.branding?.appName).toBe(DEFAULT_CONFIG.branding.appName);
  });

  it("importConfig rejects invalid JSON", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    let outcome: ReturnType<typeof result.current.importConfig> | undefined;
    act(() => {
      outcome = result.current.importConfig("{{bad json}}");
    });

    expect(outcome?.success).toBe(false);
    if (outcome && !outcome.success) {
      expect(outcome.error).toBe("Invalid JSON");
    }
  });

  it("importConfig rejects a schema-invalid config", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    let outcome: ReturnType<typeof result.current.importConfig> | undefined;
    act(() => {
      outcome = result.current.importConfig(JSON.stringify({ version: "not-a-number" }));
    });

    expect(outcome?.success).toBe(false);
  });

  it("importConfig accepts valid JSON and updates the config", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    let outcome: ReturnType<typeof result.current.importConfig> | undefined;
    act(() => {
      outcome = result.current.importConfig(
        JSON.stringify({ version: 1, branding: { appName: "Imported" } }),
      );
    });

    expect(outcome?.success).toBe(true);
    expect(result.current.config.branding.appName).toBe("Imported");
  });

  it("exportConfig returns valid JSON matching the current config", () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: makeWrapper(TEST_APP_ID),
    });

    const json = result.current.exportConfig();
    const parsed = JSON.parse(json) as typeof DEFAULT_CONFIG;
    expect(parsed).toEqual(DEFAULT_CONFIG);
  });
});
