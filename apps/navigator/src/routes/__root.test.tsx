import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { routeTree } from "../routeTree.gen";

// AuthShell (packages/features/auth-shell) is the real, unmocked component —
// it's exercised through these lower-level mocks of what it depends on.
vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock("@contentgrid/ui", () => ({
  SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
    <button onClick={onSignIn}>Sign in</button>
  ),
}));

vi.mock("@contentgrid/features/entity-browser", async () => {
  const router =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    EntityListLayout: () => <router.Outlet />,
    EntityOverviewPage: () => <div data-testid="entity-overview" />,
    EntityProfileGate: () => <router.Outlet />,
    EntityDetailPage: () => {
      const { entity } = router.useParams({ strict: false }) as { entity: string };
      return <div data-testid="entity-detail" data-entity={entity} />;
    },
    EntityItemDetailPage: () => <div data-testid="entity-item-detail" />,
    // The $entity/index, $entity, and $entity/$itemId route loaders call these
    // unconditionally — the null-context guard lives inside the real
    // implementation, so the mocks must provide them.
    ensureEntityDetailLoaderData: vi.fn(),
    ensureEntityProfileGateLoaderData: vi.fn().mockResolvedValue({}),
    ensureEntityItemDetailLoaderData: vi.fn(),
  };
});

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
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

function renderRouter(initialPath = "/") {
  const router = createRouter({
    routeTree,
    // apiFetch/profileUrl null: route loaders (added to the $entity subtree)
    // guard on this and skip prefetching, same as before auth resolves.
    context: { queryClient: new QueryClient(), apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router} />);
}

// Auth-branching behavior (loading/expired/unauthenticated/authenticated) is
// covered by AuthShell's own tests (packages/features/src/auth-shell). This
// file only verifies the route tree wires up correctly once authenticated.
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
});
