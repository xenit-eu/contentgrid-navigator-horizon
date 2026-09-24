/**
 * Tests for EntityItemCollectionRoute's search-term ("q") URL-state wiring (T019, FR-016) —
 * the piece that sits between the URL and EntitySearchBar. EntityItemCollectionView and
 * EntitySearchBar are mocked to data-capturing stubs (same technique as ../../__root.test.tsx
 * and apps/navigator's own $entity/index.test.tsx) so these tests isolate the route's own
 * state/effects without re-exercising either component's own behavior.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { makeTestAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { routeTree } from "../../../routeTree.gen";

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

afterEach(cleanup);

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    getAppConfig: () => makeTestAppConfig(),
    useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
    useProfileEntity: ({ name }: { name?: string }) => ({
      data: name ? { name, pluralName: `${name}s`, singularName: name } : undefined,
      isPending: false,
      isError: false,
      error: undefined,
    }),
  };
});

vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
      <button onClick={onSignIn}>Sign in</button>
    ),
  };
});

vi.mock("@contentgrid/features/dashboard", () => ({
  EntityCountOverview: () => <div data-testid="entity-overview" />,
}));

vi.mock("@contentgrid/features/entity-item-collection", () => ({
  // Renders `searchBar` — the route now passes EntitySearchBar down through this prop (it
  // renders in the table's own toolbar row) rather than as a sibling element, so these tests'
  // mocked EntitySearchBar stub needs an actual mount point to be reachable via `screen`.
  EntityItemCollectionView: ({ searchBar }: { searchBar?: ReactNode }) => (
    <div data-testid="collection-view">{searchBar}</div>
  ),
}));

// Captures the query the route hands down, and exposes a button that fires onQueryChange the
// same way a real EntitySearchBar's input would.
vi.mock("@contentgrid/features/entity-search-bar", () => ({
  EntitySearchBar: (props: { query: string; onQueryChange: (query: string) => void }) => (
    <div>
      <div data-testid="query">{props.query}</div>
      <button onClick={() => props.onQueryChange("Acme Corp")}>type-query</button>
    </div>
  ),
}));

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

beforeEach(() => {
  vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
});

function renderEntityRoute(queryClient: QueryClient, initialPath = "/invoice") {
  const router = createRouter({
    routeTree,
    context: { queryClient, apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AnyRouter;

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, router };
}

describe("EntityItemCollectionRoute — search term ('q') URL-state wiring", () => {
  it("pre-fills the search term from a deep-linked ?q=... URL", async () => {
    const queryClient = new QueryClient();
    await renderEntityRoute(queryClient, "/invoice?q=Acme%20Corp");

    expect(await screen.findByTestId("query")).toHaveTextContent("Acme Corp");
  });

  it("shows no search term when the URL has none", async () => {
    const queryClient = new QueryClient();
    await renderEntityRoute(queryClient, "/invoice");

    expect(await screen.findByTestId("query")).toHaveTextContent("");
  });

  it("reflects a typed search term back into the URL, debounced", async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    const { router } = renderEntityRoute(queryClient, "/invoice");
    await screen.findByTestId("query");

    await user.click(screen.getByText("type-query"));
    expect(await screen.findByTestId("query")).toHaveTextContent("Acme Corp");

    await waitFor(() => expect(router.state.location.search).toEqual({ q: "Acme Corp" }), {
      timeout: 2000,
    });
  });

  it("restores the search term when the URL changes externally (e.g. browser back)", async () => {
    const queryClient = new QueryClient();
    const { router } = await Promise.resolve(renderEntityRoute(queryClient, "/invoice?q=Acme"));
    await screen.findByTestId("query");

    await router.navigate({
      to: "/$entity",
      params: { entity: "invoice" },
      search: { q: "Beta Corp" },
    });

    expect(await screen.findByTestId("query")).toHaveTextContent("Beta Corp");
  });
});
