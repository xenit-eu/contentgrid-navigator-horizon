import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { loadAppConfig, useAppAuth } from "@contentgrid/navigator-data";
import { mountNavigatorApp } from "./navigator-app";

// Mirrors the mocking pattern in apps/*/src/routes/__root.test.tsx and
// packages/features/src/auth-shell/auth-shell.test.tsx — AppConfigProvider,
// AuthProvider, and NavigatorDataProvider become pass-through wrappers so
// this test exercises mountNavigatorApp's own orchestration (mocking gate,
// config load, mount, router-context bridge) without needing real app config
// or a real OIDC provider.
vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    loadAppConfig: vi.fn().mockResolvedValue({}),
    AppConfigProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

function makeAuthResult(overrides: Record<string, unknown> = {}): AppAuthResult {
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user: null,
      error: undefined,
      signinRedirect: vi.fn(),
      ...overrides,
    },
    apiFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

/** A minimal real router — single root route, no children — sufficient for
 * `RouterProvider` to mount without throwing. Tests spy on its real
 * `update`/`invalidate` methods rather than faking the whole router API. */
function makeTestRouter() {
  const rootRoute = createRootRoute({ component: () => <div data-testid="mounted" /> });
  return createRouter({
    routeTree: rootRoute,
    context: { queryClient: new QueryClient(), apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

let rootEl: HTMLElement;
beforeEach(() => {
  rootEl = document.createElement("div");
  document.body.appendChild(rootEl);
});

afterEach(() => {
  rootEl.remove();
  vi.clearAllMocks();
});

describe("mountNavigatorApp", () => {
  it("calls enableMocking before loadAppConfig, then mounts", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    const calls: string[] = [];
    const enableMocking = vi.fn(async () => {
      calls.push("mocking");
    });
    vi.mocked(loadAppConfig).mockImplementation(async () => {
      calls.push("config");
      return {} as never;
    });
    const router = makeTestRouter();

    await mountNavigatorApp({ rootEl, router, queryClient: new QueryClient(), enableMocking });

    expect(calls).toEqual(["mocking", "config"]);
    await waitFor(() => expect(rootEl.querySelector('[data-testid="mounted"]')).not.toBeNull());
  });

  it("mounts without calling enableMocking when it is omitted", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    const router = makeTestRouter();

    await mountNavigatorApp({ rootEl, router, queryClient: new QueryClient() });

    await waitFor(() => expect(rootEl.querySelector('[data-testid="mounted"]')).not.toBeNull());
  });

  it("pushes apiFetch/profileUrl into router context once auth is ready", async () => {
    const authResult = makeAuthResult();
    vi.mocked(useAppAuth).mockReturnValue(authResult);
    const router = makeTestRouter();
    const updateSpy = vi.spyOn(router, "update");
    const invalidateSpy = vi.spyOn(router, "invalidate");
    const queryClient = new QueryClient();

    await mountNavigatorApp({ rootEl, router, queryClient });

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        context: {
          queryClient,
          apiFetch: authResult.apiFetch,
          profileUrl: authResult.profileUrl,
        },
      });
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("does not push context into the router while auth is still loading", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isLoading: true }));
    const router = makeTestRouter();
    const updateSpy = vi.spyOn(router, "update");

    await mountNavigatorApp({ rootEl, router, queryClient: new QueryClient() });

    // Give any pending effect a chance to run before asserting the negative.
    await new Promise((r) => setTimeout(r, 20));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("renders a config-load failure message into rootEl instead of throwing", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    vi.mocked(loadAppConfig).mockRejectedValueOnce(new Error("bad config"));
    const router = makeTestRouter();

    await mountNavigatorApp({ rootEl, router, queryClient: new QueryClient() });

    expect(rootEl.textContent).toBe("Failed to load app configuration: bad config");
  });
});
