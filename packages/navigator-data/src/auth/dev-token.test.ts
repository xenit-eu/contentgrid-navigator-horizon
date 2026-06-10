import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevToken, isDevTokenMode } from "./dev-token";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDevTokenMode", () => {
  it("returns true when VITE_DEV_TOKEN is set", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "my-token");
    expect(isDevTokenMode()).toBe(true);
  });

  it("returns false when VITE_DEV_TOKEN is empty", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "");
    expect(isDevTokenMode()).toBe(false);
  });
});

describe("getDevToken", () => {
  it("returns the token string when VITE_DEV_TOKEN is set", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "my-secret-token");
    expect(getDevToken()).toBe("my-secret-token");
  });

  it("returns null when VITE_DEV_TOKEN is not set", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "");
    expect(getDevToken()).toBeNull();
  });
});
