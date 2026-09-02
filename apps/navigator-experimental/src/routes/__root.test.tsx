import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { makeTestAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { routeTree } from "../routeTree.gen";

// jsdom does not implement window.matchMedia; SideBarLayout renders the real
// SidebarProvider (@contentgrid/ui), which uses useIsMobile → matchMedia.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

// AuthShell (packages/features/auth-shell) is the real, unmocked component —
// it's exercised through these lower-level mocks of what it depends on.
// NavigatorDataProvider itself is NOT mocked: AuthShell renders it for real
// (fed by the mocked useAppAuth below), so real hooks further down the tree
// (useLoadedProfileEntities, useProfileEntity) get a working context instead
// of throwing "useNavigatorData must be used within <NavigatorDataProvider>".
vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    // AuthShell's real useCrossTabSignOut() calls this on mount — unmocked, it
    // throws ("App config not loaded") since this test never calls
    // loadAppConfig(), crashing the route into its error boundary.
    getAppConfig: () => makeTestAppConfig(),
    // SideBarLayout (real) renders the sidebar's entity list from this.
    useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
    // EntityProfileGate and the $entity/index route (both real) resolve the
    // profile from this instead of hitting a real HAL backend.
    useProfileEntity: ({ name }: { name?: string }) => ({
      data: name ? { name, pluralName: `${name}s`, singularName: name } : undefined,
      isPending: false,
      isError: false,
      error: undefined,
    }),
  };
});

vi.mock("@contentgrid/dev-tools", () => ({
  ApplicationSelectorPage: () => <div>Application Selector</div>,
}));

vi.mock("@contentgrid/features/_experimental-placeholder", () => ({
  ExperimentalSandbox: () => null,
}));

// Page-level components are mocked to isolate this test to route-tree wiring
// — their own rendering/data-fetching behavior is covered by their own tests.
vi.mock("@contentgrid/features/dashboard", () => ({
  EntityCountOverview: () => <div data-testid="entity-overview" />,
}));

vi.mock("@contentgrid/features/entity-item-collection", () => ({
  EntityItemCollectionSearchView: ({ profile }: { profile: { name: string } }) => (
    <div data-testid="entity-detail" data-entity={profile.name} />
  ),
}));

afterEach(cleanup);

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
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

function renderRouter(initialPath = "/") {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    // apiFetch/profileUrl null: route loaders (added to the $entity subtree)
    // guard on this and skip prefetching, same as before auth resolves.
    context: { queryClient, apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  // mountNavigatorApp (the real bootstrap) wraps RouterProvider in
  // QueryClientProvider — components calling useQueryClient() directly
  // (e.g. EntityItemCollectionRoute) need that same wiring here.
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// Auth-branching behavior (loading/expired/unauthenticated/authenticated) is
// covered by AuthShell's own tests (packages/features/src/auth-shell). This
// file only verifies the experimental route tree wires up correctly once
// authenticated.
describe("AppLayout — entity routing", () => {
  beforeEach(() => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
  });

  it("renders entity overview when no entity is in the URL", async () => {
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-overview")).toBeInTheDocument();
    });
  });

  it("renders entity detail when entity path param is in the URL", async () => {
    renderRouter("/invoice");
    await waitFor(() => {
      expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-entity", "invoice");
  });

  it("renders the Application Selector on the dev-only /config route", async () => {
    renderRouter("/config");
    // The selector is lazy-loaded behind import.meta.env.DEV, which is true in
    // vitest (test mode), so it must be awaited rather than asserted synchronously.
    expect(await screen.findByText("Application Selector")).toBeInTheDocument();
  });
});

describe("ExperimentalBanner", () => {
  beforeEach(() => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    window.sessionStorage.clear();
  });

  it("renders the experimental warning alongside the routed page", async () => {
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Experimental — not for production use");
    });
  });
});
