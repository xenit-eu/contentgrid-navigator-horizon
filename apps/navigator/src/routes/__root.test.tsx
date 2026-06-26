import type { ReactNode } from "react";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { routeTree } from "../routeTree.gen";

vi.mock("@contentgrid/navigator-data", () => ({
  useAppAuth: vi.fn(),
  NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@contentgrid/ui", () => ({
  SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
    <button onClick={onSignIn}>Sign in</button>
  ),
}));

vi.mock("@contentgrid/features/navigator-header", () => ({
  NavigatorHeader: () => <header role="banner" data-testid="navigator-header" />,
}));

vi.mock("@contentgrid/features/entity-list", async () => {
  const router =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    EntityListLayout: () => <router.Outlet />,
    EntityOverviewPage: () => <div data-testid="entity-overview" />,
    EntityDetailPage: () => {
      const { entity } = router.useParams({ strict: false }) as { entity: string };
      return <div data-testid="entity-detail" data-entity={entity} />;
    },
    EntityItemDetailPage: () => <div data-testid="entity-item-detail" />,
    entityDetailSearchValidator: (s: Record<string, unknown>) => s,
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
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("RootComponent — auth states", () => {
  it("renders nothing while auth is loading", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ isLoading: true, isAuthenticated: false }),
    );
    const { container } = renderRouter();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the user token is expired and there is no error", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ user: { expired: true }, error: undefined }),
    );
    const { container } = renderRouter();
    expect(container.firstChild).toBeNull();
  });

  it("renders SignInGate when user is not authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    renderRouter();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });
  });

  it("renders the navigator header when authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    renderRouter();
    await waitFor(() => {
      expect(screen.getByTestId("navigator-header")).toBeInTheDocument();
    });
  });
});

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
