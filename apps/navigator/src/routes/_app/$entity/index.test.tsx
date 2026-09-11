/**
 * Tests for EntityItemCollectionRoute's filters/pageUrl memo wiring — the piece that sits
 * between the URL and EntityItemCollectionView (itself covered by
 * packages/features/src/entity-item-collection/entity-item-collection-view.test.tsx).
 *
 * EntityItemCollectionSearchView is mocked to a data-capturing stub (same technique as
 * ../../__root.test.tsx) so these tests isolate the route's own state/effects — recalling from
 * the QueryClient memos, syncing the URL, and writing back on a real filter change — without
 * re-exercising the view's own pageUrl/filters reconciliation.
 */
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
import {
  recallCollectionFilters,
  recallCollectionPageHref,
  rememberCollectionFilters,
  rememberCollectionPageHref,
  useAppAuth,
} from "@contentgrid/navigator-data";
import { makeTestAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { routeTree } from "../../../routeTree.gen";

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

afterEach(cleanup);

// Same mock stack as ../../__root.test.tsx: AuthShell/SideBarLayout are the real, unmocked
// components — they're exercised through mocks of what THEY depend on, so the real
// EntityItemCollectionRoute underneath gets a working NavigatorDataProvider context.
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

// Captures whatever EntityItemCollectionRoute passes down, and exposes buttons that fire the
// same callbacks a real FilterSidebar/table interaction would.
vi.mock("@contentgrid/features/entity-item-collection", () => ({
  EntityItemCollectionSearchView: (props: {
    pageUrl?: string;
    filters?: Record<string, string>;
    onFiltersChange?: (filters: Record<string, string>) => void;
    onPageChange?: (href: string | undefined) => void;
  }) => (
    <div>
      <div data-testid="filters">{JSON.stringify(props.filters ?? null)}</div>
      <div data-testid="pageUrl">{props.pageUrl ?? ""}</div>
      <button onClick={() => props.onFiltersChange?.({ status: "closed" })}>change-filters</button>
      <button
        onClick={() =>
          props.onPageChange?.("https://api.example.com/invoices?status=open&_cursor=next")
        }
      >
        go-next-page
      </button>
    </div>
  ),
}));

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

describe("EntityItemCollectionRoute — filters/pageUrl memo wiring", () => {
  it("recalls remembered filters when the URL has none, and reflects them back into the URL", async () => {
    const queryClient = new QueryClient();
    rememberCollectionFilters(queryClient, "invoice", { status: "open" });

    const { router } = renderEntityRoute(queryClient, "/invoice");

    expect(await screen.findByTestId("filters")).toHaveTextContent('{"status":"open"}');
    await waitFor(() => expect(router.state.location.search).toEqual({ "s.status": "open" }));
  });

  it("prefers the URL's own filters over the remembered memo when the URL already has some", async () => {
    const queryClient = new QueryClient();
    rememberCollectionFilters(queryClient, "invoice", { status: "open" });

    await renderEntityRoute(queryClient, "/invoice?s.status=closed");

    expect(await screen.findByTestId("filters")).toHaveTextContent('{"status":"closed"}');
  });

  it("writes filters that arrive via the URL into the memo, not just ones set through the sidebar", async () => {
    const queryClient = new QueryClient();

    await renderEntityRoute(queryClient, "/invoice?s.status=open");

    expect(await screen.findByTestId("filters")).toHaveTextContent('{"status":"open"}');
    await waitFor(() =>
      expect(recallCollectionFilters(queryClient, "invoice")).toEqual({ status: "open" }),
    );
  });

  it("shows no filters when neither the URL nor the memo has any", async () => {
    const queryClient = new QueryClient();

    await renderEntityRoute(queryClient, "/invoice");

    expect(await screen.findByTestId("filters")).toHaveTextContent("{}");
  });

  it("a real filter change clears the page-href memo and writes the new filters memo", async () => {
    const queryClient = new QueryClient();
    rememberCollectionPageHref(queryClient, "invoice", "https://api.example.com/invoices?p=3");
    const user = userEvent.setup();

    const { router } = renderEntityRoute(queryClient, "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("change-filters"));

    await waitFor(() =>
      expect(recallCollectionFilters(queryClient, "invoice")).toEqual({ status: "closed" }),
    );
    expect(recallCollectionPageHref(queryClient, "invoice")).toBeUndefined();
    expect(router.state.location.search).toEqual({ "s.status": "closed" });
  });

  it("pagination remembers the target href without touching the filters memo", async () => {
    const queryClient = new QueryClient();
    rememberCollectionFilters(queryClient, "invoice", { status: "open" });
    const user = userEvent.setup();

    renderEntityRoute(queryClient, "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("go-next-page"));

    await waitFor(() =>
      expect(recallCollectionPageHref(queryClient, "invoice")).toBe(
        "https://api.example.com/invoices?status=open&_cursor=next",
      ),
    );
    expect(recallCollectionFilters(queryClient, "invoice")).toEqual({ status: "open" });
  });
});
