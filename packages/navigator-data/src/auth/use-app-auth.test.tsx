import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthContext } from "react-oidc-context";
import type { AuthContextProps, User } from "react-oidc-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppAuth } from "./use-app-auth";

vi.mock("./auth-config", () => ({
  getAppConfig: () => ({
    apiBaseUrl: "https://api.example.com",
    authority: "https://oidc.example.com",
    clientId: "client",
  }),
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

  it("calls removeUser when signinSilent rejects", async () => {
    const removeUser = vi.fn().mockResolvedValue(undefined);
    const ctx = makeAuthCtx({
      isLoading: false,
      error: undefined,
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent: vi.fn().mockRejectedValue(new Error("renew failed")),
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
      error: new Error("auth error"),
      user: { expired: true, access_token: "tok" } as unknown as User,
      signinSilent,
    });
    renderHook(() => useAppAuth(), { wrapper: makeWrapper(ctx) });
    expect(signinSilent).not.toHaveBeenCalled();
  });
});
