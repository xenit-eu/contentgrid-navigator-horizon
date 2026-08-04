import { cleanup, render } from "@testing-library/react";
import { AuthContext } from "react-oidc-context";
import type { AuthContextProps } from "react-oidc-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCrossTabSignOut } from "./cross-tab-signout";

vi.mock("./auth-config", () => ({
  getAppConfig: () => ({
    apiBaseUrl: "https://api.example.com",
    authority: "https://oidc.example.com",
    clientId: "client",
  }),
}));

const OIDC_USER_KEY = "oidc.user:https://oidc.example.com:client";

afterEach(cleanup);

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

function HookRunner() {
  useCrossTabSignOut();
  return null;
}

function renderCrossTabSignOut(ctx: AuthContextProps) {
  return render(
    <AuthContext.Provider value={ctx}>
      <HookRunner />
    </AuthContext.Provider>,
  );
}

function dispatchStorageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

describe("useCrossTabSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out when another tab clears the oidc user storage key", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent(OIDC_USER_KEY, null);

    expect(ctx.signoutRedirect).toHaveBeenCalledOnce();
  });

  it("ignores storage events for unrelated keys", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent("some-other-key", null);

    expect(ctx.signoutRedirect).not.toHaveBeenCalled();
  });

  it("ignores storage events on the oidc key when a value is still present", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent(OIDC_USER_KEY, "{}");

    expect(ctx.signoutRedirect).not.toHaveBeenCalled();
  });

  it("signs out when the entire storage is cleared (key: null)", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent(null, null);

    expect(ctx.signoutRedirect).toHaveBeenCalledOnce();
  });

  it("removes its listener on unmount", () => {
    const ctx = makeAuthCtx();
    const { unmount } = renderCrossTabSignOut(ctx);
    unmount();

    dispatchStorageEvent(OIDC_USER_KEY, null);

    expect(ctx.signoutRedirect).not.toHaveBeenCalled();
  });

  it("does not re-subscribe when the auth object identity changes, and always signs out with the latest instance", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const ctx1 = makeAuthCtx();
    const ctx2 = makeAuthCtx();

    const { rerender } = renderCrossTabSignOut(ctx1);
    const storageSubscriptions = () =>
      addSpy.mock.calls.filter(([type]) => type === "storage").length;

    expect(storageSubscriptions()).toBe(1);

    rerender(
      <AuthContext.Provider value={ctx2}>
        <HookRunner />
      </AuthContext.Provider>,
    );

    // Still only the one subscription from mount — no teardown/re-add on auth change.
    expect(storageSubscriptions()).toBe(1);
    expect(removeSpy.mock.calls.filter(([type]) => type === "storage")).toHaveLength(0);

    dispatchStorageEvent(OIDC_USER_KEY, null);

    expect(ctx2.signoutRedirect).toHaveBeenCalledOnce();
    expect(ctx1.signoutRedirect).not.toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
