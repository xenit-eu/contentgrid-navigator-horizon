import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@contentgrid/navigator-data";
import { useCrossTabSignOut } from "./cross-tab-signout";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    getAppConfig: () => ({
      apiBaseUrl: "https://api.example.com",
      authority: "https://oidc.example.com",
      clientId: "client",
    }),
    useAuth: vi.fn(),
  };
});

const OIDC_USER_KEY = "oidc.user:https://oidc.example.com:client";

afterEach(cleanup);

function makeAuthCtx(): ReturnType<typeof useAuth> {
  return {
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useAuth>;
}

function HookRunner() {
  useCrossTabSignOut();
  return null;
}

function renderCrossTabSignOut(ctx: ReturnType<typeof useAuth>) {
  vi.mocked(useAuth).mockReturnValue(ctx);
  return render(<HookRunner />);
}

function dispatchStorageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

describe("useCrossTabSignOut", () => {
  it("signs out when another tab's session is cleared", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent(OIDC_USER_KEY, null); // the oidc key specifically cleared
    dispatchStorageEvent(null, null); // or a full localStorage.clear()

    expect(ctx.signoutRedirect).toHaveBeenCalledTimes(2);
  });

  it("does not sign out for unrelated or non-clearing storage changes", () => {
    const ctx = makeAuthCtx();
    renderCrossTabSignOut(ctx);

    dispatchStorageEvent("some-other-key", null); // unrelated key
    dispatchStorageEvent(OIDC_USER_KEY, "{}"); // oidc key updated, not cleared

    expect(ctx.signoutRedirect).not.toHaveBeenCalled();
  });
});
