import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "oidc-client-ts";
import { AuthContext } from "react-oidc-context";
import type { AuthContextProps } from "react-oidc-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestAppConfig } from "../../test-fixtures/auth/app-config";
import { getAppConfig } from "./auth-config";
import { isAuthReady, useAppAuth } from "./use-app-auth";

// A vi.fn() (not a fixed factory) so individual tests can configure a different
// RuntimeAppConfig (e.g. with renditionUri set) via `vi.mocked(getAppConfig).mockReturnValue`.
vi.mock("./auth-config", () => ({
  getAppConfig: vi.fn(),
}));

function makeAuthCtx(overrides: Partial<AuthContextProps> = {}): AuthContextProps {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    activeNavigator: undefined,
    error: undefined,
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signinSilent: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
    signinPopup: vi.fn().mockResolvedValue(undefined),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    signoutPopup: vi.fn().mockResolvedValue(undefined),
    signoutSilent: vi.fn().mockResolvedValue(undefined),
    clearStaleState: vi.fn().mockResolvedValue(undefined),
    revokeTokens: vi.fn().mockResolvedValue(undefined),
    signinResourceOwnerCredentials: vi.fn().mockResolvedValue(undefined),
    querySessionStatus: vi.fn().mockResolvedValue(undefined),
    startSilentRenew: vi.fn(),
    stopSilentRenew: vi.fn(),
    settings: {} as never,
    events: {} as never,
    ...overrides,
  } as AuthContextProps;
}

function makeWrapper(ctx: AuthContextProps) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
  };
}

describe("useAppAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppConfig).mockReturnValue(makeTestAppConfig());
  });

  it("returns auth, apiFetch, and profileUrl derived from app config", () => {
    const ctx = makeAuthCtx();
    const { result } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });

    expect(result.current.auth).toBe(ctx);
    expect(typeof result.current.apiFetch).toBe("function");
    expect(result.current.profileUrl).toBe("https://api.example.com/profile");
  });

  it("apiFetch reference is stable across re-renders", () => {
    const ctx = makeAuthCtx();
    const { result, rerender } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    const firstFetch = result.current.apiFetch;
    rerender();
    expect(result.current.apiFetch).toBe(firstFetch);
  });

  it("applies the 2000ms/60000ms rendition defaults when renditionUri is set but the poll settings are not", () => {
    vi.mocked(getAppConfig).mockReturnValue(
      makeTestAppConfig({ renditionUri: "https://renditions.example.com/get/pdf{?url}" }),
    );
    const ctx = makeAuthCtx();
    const { result } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });

    expect(result.current.renditionUri).toBe("https://renditions.example.com/get/pdf{?url}");
    expect(result.current.renditionPolling).toEqual({ intervalMs: 2000, timeoutMs: 60000 });
  });

  it("uses the configured poll interval/timeout instead of the defaults when both are set", () => {
    vi.mocked(getAppConfig).mockReturnValue(
      makeTestAppConfig({
        renditionUri: "https://renditions.example.com/get/pdf{?url}",
        renditionPollIntervalMs: 500,
        renditionTimeoutMs: 5000,
      }),
    );
    const ctx = makeAuthCtx();
    const { result } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });

    expect(result.current.renditionPolling).toEqual({ intervalMs: 500, timeoutMs: 5000 });
  });

  it("leaves renditionUri and renditionPolling undefined when renditionUri is not set", () => {
    const ctx = makeAuthCtx();
    const { result } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });

    expect(result.current.renditionUri).toBeUndefined();
    expect(result.current.renditionPolling).toBeUndefined();
  });

  it("renditionPolling reference is stable across re-renders (NavigatorDataProvider memoises on it)", () => {
    vi.mocked(getAppConfig).mockReturnValue(
      makeTestAppConfig({ renditionUri: "https://renditions.example.com/get/pdf{?url}" }),
    );
    const ctx = makeAuthCtx();
    const { result, rerender } = renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    const firstRenditionPolling = result.current.renditionPolling;

    rerender();

    expect(result.current.renditionPolling).toBe(firstRenditionPolling);
  });

  it("calls signinSilent when user is expired and not loading", async () => {
    const signinSilent = vi.fn().mockResolvedValue(undefined);
    const ctx = makeAuthCtx({
      isLoading: false,
      error: undefined,
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    await waitFor(() => expect(signinSilent).toHaveBeenCalledOnce());
  });

  it("calls removeUser when signinSilent resolves null (renewal failed)", async () => {
    // react-oidc-context's signinSilent() never rejects on failure — it resolves
    // `null` after dispatching its own error internally. See use-app-auth.ts.
    const removeUser = vi.fn().mockResolvedValue(undefined);
    const ctx = makeAuthCtx({
      isLoading: false,
      error: undefined,
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent: vi.fn().mockResolvedValue(null),
      removeUser,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    await waitFor(() => expect(removeUser).toHaveBeenCalledOnce());
  });

  it("does not call signinSilent when user is not expired", () => {
    const signinSilent = vi.fn();
    const ctx = makeAuthCtx({
      isLoading: false,
      user: { expired: false, access_token: "tok" } as unknown as User,
      signinSilent,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    expect(signinSilent).not.toHaveBeenCalled();
  });

  it("does not call signinSilent when auth is still loading", () => {
    const signinSilent = vi.fn();
    const ctx = makeAuthCtx({
      isLoading: true,
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    expect(signinSilent).not.toHaveBeenCalled();
  });

  it("does not call signinSilent when there is an auth error", () => {
    const signinSilent = vi.fn();
    const ctx = makeAuthCtx({
      isLoading: false,
      error: Object.assign(new Error("auth error"), { source: "unknown" as const }),
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    expect(signinSilent).not.toHaveBeenCalled();
  });
});

describe("isAuthReady", () => {
  it("is true when not loading, authenticated, and the user is not expired", () => {
    const ctx = makeAuthCtx({
      isLoading: false,
      isAuthenticated: true,
      user: { expired: false, access_token: "tok" } as unknown as User,
    });
    expect(isAuthReady(ctx)).toBe(true);
  });

  it("is false when a background silent-renewal failed, even though isAuthenticated is stale-true", () => {
    // react-oidc-context's ERROR reducer case never touches isAuthenticated/user,
    // so both stay at their pre-failure values — expired stays true and
    // isAuthenticated stays true. isAuthReady must not trust isAuthenticated alone.
    const ctx = makeAuthCtx({
      isLoading: false,
      isAuthenticated: true,
      user: { expired: true, access_token: "tok" } as unknown as User,
      error: Object.assign(new Error("renew failed"), {
        source: "signinSilent" as const,
        args: undefined,
      }),
    });
    expect(isAuthReady(ctx)).toBe(false);
  });
});
