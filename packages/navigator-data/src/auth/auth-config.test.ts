import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_WINDOW_CONFIG = {
  v1: {
    apiBaseUrl: "https://api.example.com",
    oidc: { authority: "https://oidc.example.com", client_id: "my-client" },
  },
};

// auth-config has module-level cachedConfig state — reset modules before each test
// so each import gets a fresh module instance with cachedConfig = null.
beforeEach(() => {
  vi.resetModules();
  delete (window as { contentGridConfig?: unknown }).contentGridConfig;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("loadAppConfig — window.contentGridConfig path", () => {
  it("returns config when already set on window", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://api.example.com");
    expect(cfg.authority).toBe("https://oidc.example.com");
    expect(cfg.clientId).toBe("my-client");
  });

  it("ignores window.contentGridConfig with template placeholders and falls back to env vars", async () => {
    window.contentGridConfig = {
      v1: {
        apiBaseUrl: "${API_BASE_URL}",
        oidc: { authority: "${OIDC_AUTHORITY}", client_id: "ok" },
      },
    };
    vi.stubEnv("VITE_OIDC_AUTHORITY", "https://oidc.env.com");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.env.com");
    vi.stubEnv("VITE_OIDC_CLIENT_ID", "env-client");
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.authority).toBe("https://oidc.env.com");
  });
});

describe("loadAppConfig — fetch config.js path", () => {
  it("parses a valid config.js response", async () => {
    const configJs = `window.contentGridConfig = ${JSON.stringify(VALID_WINDOW_CONFIG)};`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(configJs, { status: 200 }));
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://api.example.com");
  });

  it("falls back to env vars when config.js returns a non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubEnv("VITE_OIDC_AUTHORITY", "https://fallback.oidc.com");
    vi.stubEnv("VITE_API_BASE_URL", "https://fallback.api.com");
    vi.stubEnv("VITE_OIDC_CLIENT_ID", "fallback-client");
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.authority).toBe("https://fallback.oidc.com");
  });

  it("falls back to env vars when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    vi.stubEnv("VITE_OIDC_AUTHORITY", "https://fallback.oidc.com");
    vi.stubEnv("VITE_API_BASE_URL", "https://fallback.api.com");
    vi.stubEnv("VITE_OIDC_CLIENT_ID", "fallback-client");
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.authority).toBe("https://fallback.oidc.com");
  });
});

describe("loadAppConfig — env var path", () => {
  it("throws when all env vars are missing and not dev mode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    vi.stubEnv("VITE_DEV_TOKEN", "");
    vi.stubEnv("VITE_OIDC_AUTHORITY", "");
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_OIDC_CLIENT_ID", "");
    const { loadAppConfig } = await import("./auth-config");
    await expect(loadAppConfig()).rejects.toThrow("Cannot derive config from hostname");
  });

  it("succeeds in dev token mode with only VITE_API_BASE_URL set", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    vi.stubEnv("VITE_DEV_TOKEN", "my-dev-token");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.local");
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://api.local");
    expect(cfg.authority).toBe("");
  });

  it("throws in dev token mode when VITE_API_BASE_URL is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    vi.stubEnv("VITE_DEV_TOKEN", "my-dev-token");
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { loadAppConfig } = await import("./auth-config");
    await expect(loadAppConfig()).rejects.toThrow("VITE_API_BASE_URL is required");
  });
});

describe("loadAppConfig — caching", () => {
  it("returns the same object reference on subsequent calls", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig } = await import("./auth-config");
    const first = await loadAppConfig();
    window.contentGridConfig = undefined;
    const second = await loadAppConfig();
    expect(second).toBe(first);
  });
});

describe("getAppConfig", () => {
  it("throws when loadAppConfig has not been called", async () => {
    const { getAppConfig } = await import("./auth-config");
    expect(() => getAppConfig()).toThrow("App config not loaded");
  });

  it("returns the config after loadAppConfig resolves", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig, getAppConfig } = await import("./auth-config");
    await loadAppConfig();
    expect(getAppConfig().apiBaseUrl).toBe("https://api.example.com");
  });
});

describe("getOidcConfig", () => {
  it("maps AppConfig fields to AuthProviderProps", async () => {
    const { getOidcConfig } = await import("./auth-config");
    // AuthProviderProps is a union — cast to the NoUserManager branch which carries
    // all UserManagerSettings properties (authority, client_id, redirect_uri, etc.)
    type NoUMProps = {
      authority: string;
      client_id: string;
      redirect_uri: string;
      automaticSilentRenew: boolean;
    };
    const oidc = getOidcConfig({
      authority: "https://oidc.example.com",
      clientId: "my-client",
      apiBaseUrl: "https://api.example.com",
    }) as unknown as NoUMProps;
    expect(oidc.authority).toBe("https://oidc.example.com");
    expect(oidc.client_id).toBe("my-client");
    expect(oidc.redirect_uri).toBe(window.location.origin);
    expect(oidc.automaticSilentRenew).toBe(true);
  });
});
