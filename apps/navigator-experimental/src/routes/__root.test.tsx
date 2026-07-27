import type { ReactNode } from "react";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { routeTree } from "../routeTree.gen";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useProfileEntities: () => [],
  };
});

vi.mock("@contentgrid/dev-tools", () => ({
  ApplicationSelectorPage: () => <div>Application Selector</div>,
}));

vi.mock("@contentgrid/features/entity-list", async () => {
  const router =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    EntityListLayout: () => <router.Outlet />,
    EntityOverviewPage: () => <div data-testid="entity-overview" />,
    EntityDetailPage: () => <div data-testid="entity-detail" />,
    EntityItemDetailPage: () => <div data-testid="entity-item-detail" />,
  };
});

vi.mock("@contentgrid/features/_experimental-placeholder", () => ({
  ExperimentalSandbox: () => null,
}));

vi.mock("@contentgrid/features/recently-created", () => ({
  RecentlyCreatedList: () => null,
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

  it("renders the Application Selector when the user is not authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    renderRouter();
    // The selector is lazy-loaded behind import.meta.env.DEV, which is true in
    // vitest (test mode), so it must be awaited rather than asserted synchronously.
    expect(await screen.findByText("Application Selector")).toBeInTheDocument();
  });

  it("renders the app outlet (not the selector) when authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    renderRouter();
    await waitFor(() => {
      expect(screen.getByTestId("entity-overview")).toBeInTheDocument();
    });
    expect(screen.queryByText("Application Selector")).not.toBeInTheDocument();
  });
});
