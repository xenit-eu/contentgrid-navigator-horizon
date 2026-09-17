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
  localStorage.clear();
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

describe("loadAppConfig — localStorage dev override", () => {
  it("returns the stored dev override when the key is present and valid", async () => {
    const { loadAppConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    const override = {
      apiBaseUrl: "https://dev.api.com",
      authority: "https://dev.auth.com",
      clientId: "dev-client",
    };
    localStorage.setItem(DEV_CONFIG_STORAGE_KEY, JSON.stringify(override));
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://dev.api.com");
    expect(cfg.authority).toBe("https://dev.auth.com");
    expect(cfg.clientId).toBe("dev-client");
  });

  it("falls through to window config when the stored override fails schema validation", async () => {
    const { loadAppConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    localStorage.setItem(DEV_CONFIG_STORAGE_KEY, JSON.stringify({ bad: "data" }));
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://api.example.com");
  });

  it("falls through to window config when the stored override is malformed JSON", async () => {
    const { loadAppConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    localStorage.setItem(DEV_CONFIG_STORAGE_KEY, "not-json");
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const cfg = await loadAppConfig();
    expect(cfg.apiBaseUrl).toBe("https://api.example.com");
  });
});

describe("storeDevConfig", () => {
  it("writes the config to localStorage at the dev-config key", async () => {
    const { storeDevConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    storeDevConfig({ apiBaseUrl: "https://a.com", authority: "https://b.com", clientId: "c" });
    const stored = localStorage.getItem(DEV_CONFIG_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).apiBaseUrl).toBe("https://a.com");
  });

  it("resets the cached config so the next getAppConfig call throws", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig, storeDevConfig, getAppConfig } = await import("./auth-config");
    await loadAppConfig();
    storeDevConfig({ apiBaseUrl: "https://a.com", authority: "https://b.com", clientId: "c" });
    expect(() => getAppConfig()).toThrow("App config not loaded");
  });
});

describe("clearDevConfig", () => {
  it("removes the dev-config key from localStorage", async () => {
    const { clearDevConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    localStorage.setItem(DEV_CONFIG_STORAGE_KEY, "{}");
    clearDevConfig();
    expect(localStorage.getItem(DEV_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it("resets the cached config so the next getAppConfig call throws", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig, clearDevConfig, getAppConfig } = await import("./auth-config");
    await loadAppConfig();
    clearDevConfig();
    expect(() => getAppConfig()).toThrow("App config not loaded");
  });
});

describe("signinWithNewConfig", () => {
  it("stores the config in localStorage, removes the existing session, and redirects", async () => {
    const mockSigninRedirect = vi.fn().mockResolvedValue(undefined);
    const mockRemoveUser = vi.fn().mockResolvedValue(undefined);
    vi.doMock("oidc-client-ts", () => ({
      UserManager: class {
        removeUser = mockRemoveUser;
        signinRedirect = mockSigninRedirect;
      },
      WebStorageStateStore: class {},
    }));

    const { signinWithNewConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    const config = { apiBaseUrl: "https://a.com", authority: "https://b.com", clientId: "c" };
    await signinWithNewConfig(config);

    const stored = localStorage.getItem(DEV_CONFIG_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).apiBaseUrl).toBe("https://a.com");
    expect(mockRemoveUser).toHaveBeenCalledOnce();
    expect(mockSigninRedirect).toHaveBeenCalledOnce();
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

describe("loadAppConfig — rendition settings validation", () => {
  it("accepts a valid renditionUri, poll interval, and timeout from window.contentGridConfig", async () => {
    window.contentGridConfig = {
      v1: {
        ...VALID_WINDOW_CONFIG.v1,
        renditionUri: "https://renditions.example.com/get/pdf{?url}",
        renditionPollIntervalMs: 500,
        renditionTimeoutMs: 5000,
      },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBe("https://renditions.example.com/get/pdf{?url}");
    expect(cfg.renditionPollIntervalMs).toBe(500);
    expect(cfg.renditionTimeoutMs).toBe(5000);
  });

  it("drops a renditionUri missing the {?url} expansion and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.contentGridConfig = {
      v1: { ...VALID_WINDOW_CONFIG.v1, renditionUri: "https://renditions.example.com/get/pdf" },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("renditionUri"));
  });

  it("drops a renditionPollIntervalMs below 250ms and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.contentGridConfig = {
      v1: {
        ...VALID_WINDOW_CONFIG.v1,
        renditionUri: "https://renditions.example.com/get/pdf{?url}",
        renditionPollIntervalMs: 100,
      },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionPollIntervalMs).toBeUndefined();
    expect(cfg.renditionUri).toBe("https://renditions.example.com/get/pdf{?url}");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("renditionPollIntervalMs"));
  });

  it("drops a renditionTimeoutMs below the (defaulted) poll interval and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.contentGridConfig = {
      v1: {
        ...VALID_WINDOW_CONFIG.v1,
        renditionUri: "https://renditions.example.com/get/pdf{?url}",
        renditionTimeoutMs: 100, // below the default 2000ms poll interval
      },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionTimeoutMs).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("renditionTimeoutMs"));
  });

  it("drops a renditionTimeoutMs below an explicit, valid poll interval and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.contentGridConfig = {
      v1: {
        ...VALID_WINDOW_CONFIG.v1,
        renditionUri: "https://renditions.example.com/get/pdf{?url}",
        renditionPollIntervalMs: 4000,
        renditionTimeoutMs: 3000,
      },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionPollIntervalMs).toBe(4000);
    expect(cfg.renditionTimeoutMs).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("renditionTimeoutMs"));
  });

  it("prefers config.js's v1.renditionUri over the VITE_RENDITION_URI env fallback", async () => {
    vi.stubEnv("VITE_RENDITION_URI", "https://env.example.com/get/pdf{?url}");
    window.contentGridConfig = {
      v1: {
        ...VALID_WINDOW_CONFIG.v1,
        renditionUri: "https://configjs.example.com/get/pdf{?url}",
      },
    };
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBe("https://configjs.example.com/get/pdf{?url}");
  });

  it("falls back to VITE_RENDITION_URI when config.js does not set v1.renditionUri", async () => {
    vi.stubEnv("VITE_RENDITION_URI", "https://env.example.com/get/pdf{?url}");
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBe("https://env.example.com/get/pdf{?url}");
  });

  it("validates renditionUri from the localStorage dev override too", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadAppConfig, DEV_CONFIG_STORAGE_KEY } = await import("./auth-config");
    const override = {
      apiBaseUrl: "https://dev.api.com",
      authority: "https://dev.auth.com",
      clientId: "dev-client",
      renditionUri: "not-a-template",
    };
    localStorage.setItem(DEV_CONFIG_STORAGE_KEY, JSON.stringify(override));
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("renditionUri"));
  });

  it("leaves renditionUri unset when no source configures it", async () => {
    window.contentGridConfig = VALID_WINDOW_CONFIG;
    const { loadAppConfig } = await import("./auth-config");
    const cfg = await loadAppConfig();
    expect(cfg.renditionUri).toBeUndefined();
    expect(cfg.renditionPollIntervalMs).toBeUndefined();
    expect(cfg.renditionTimeoutMs).toBeUndefined();
  });
});
