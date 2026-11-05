/**
 * Tests for the list route, which renders the split view — the piece that sits between the URL
 * (filters, sort, previewed `item`) and the views' EntityItemSplitView (itself covered by
 * packages/views/src/entity-item-split/).
 *
 * The view is mocked to a data-capturing stub (same technique as
 * ../../__root.test.tsx) so these tests isolate the route's own state/effects — recalling from
 * the QueryClient memos, syncing the URL, pushing a history entry per selection, and writing back
 * on a real filter change — without re-exercising the view's own reconciliation. The real router,
 * route tree and navigation provider are used.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

// The split view is a stub that shows the state the route hands it and has buttons that report
// the same changes a real filter edit, next-page click, row click or Close would. "open-item"
// goes through the view navigation, like the preview pane's Open.
const preloadEntityItemCollection = vi.hoisted(() => vi.fn(async () => {}));
const preloadEntityItemSplit = vi.hoisted(() => vi.fn(async () => {}));

interface StubState {
  collection?: { filters?: Record<string, string>; sort?: string; pageUrl?: string };
  selectedItemId?: string;
}

vi.mock("@contentgrid/views/entity-item-collection", () => ({
  preloadEntityItemCollection,
}));

vi.mock("@contentgrid/views/entity-item-split", async () => {
  const { useViewNavigation } = await import("@contentgrid/views");
  return {
    preloadEntityItemSplit,
    EntityItemSplitView: (props: {
      entityName: string;
      state?: StubState;
      onStateChange?: (state: StubState) => void;
    }) => {
      const navigation = useViewNavigation();
      const state = props.state;
      return (
        <div>
          <div data-testid="entity">{props.entityName}</div>
          <div data-testid="filters">{JSON.stringify(state?.collection?.filters ?? null)}</div>
          <div data-testid="sort">{state?.collection?.sort ?? ""}</div>
          <div data-testid="pageUrl">{state?.collection?.pageUrl ?? ""}</div>
          <div data-testid="selected">{state?.selectedItemId ?? ""}</div>
          <button
            onClick={() =>
              props.onStateChange?.({
                ...state,
                collection: {
                  ...state?.collection,
                  filters: { status: "closed" },
                  pageUrl: undefined,
                },
              })
            }
          >
            change-filters
          </button>
          <button
            onClick={() =>
              props.onStateChange?.({
                ...state,
                collection: {
                  ...state?.collection,
                  pageUrl: "https://api.example.com/invoices?status=open&_cursor=next",
                },
              })
            }
          >
            go-next-page
          </button>
          <button onClick={() => props.onStateChange?.({ ...state, selectedItemId: "i-42" })}>
            select-42
          </button>
          <button onClick={() => props.onStateChange?.({ ...state, selectedItemId: "i-43" })}>
            select-43
          </button>
          <button onClick={() => props.onStateChange?.({ ...state, selectedItemId: undefined })}>
            close
          </button>
          <button
            onClick={() =>
              props.onStateChange?.({
                collection: {
                  ...state?.collection,
                  filters: { status: "closed" },
                  pageUrl: undefined,
                },
                selectedItemId: "i-44",
              })
            }
          >
            filter-and-select
          </button>
          <button
            onClick={() =>
              state?.selectedItemId && navigation.openItem(props.entityName, state.selectedItemId)
            }
          >
            open-item
          </button>
        </div>
      );
    },
  };
});

// The `$entity` parent route's `beforeLoad` awaits this; making it slow keeps a navigation pending.
const ensureEntityProfileLoaded = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@contentgrid/views/entity-profile-gate", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ensureEntityProfileLoaded };
});

const preloadEntityItemDetail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@contentgrid/views/entity-item-detail", () => ({
  preloadEntityItemDetail,
  EntityItemDetailView: (props: { entityName: string; itemId: string }) => (
    <div data-testid="detail">{`${props.entityName}/${props.itemId}`}</div>
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

describe("EntityItemCollectionRoute — split view wiring", () => {
  it("preloads the entity's collection view in its loader when no item is selected", async () => {
    const queryClient = new QueryClient();
    renderEntityRoute(queryClient, "/invoice");
    await screen.findByTestId("filters");

    // The router context the app was created with: the same QueryClient, the API client still absent.
    expect(preloadEntityItemCollection).toHaveBeenCalledWith(
      expect.objectContaining({ queryClient, apiFetch: null, profileUrl: null }),
      "invoice",
    );
    expect(preloadEntityItemSplit).not.toHaveBeenCalled();
  });

  it("preloads the split view with the item in its loader when `item` is set", async () => {
    const queryClient = new QueryClient();
    renderEntityRoute(queryClient, "/invoice?item=i-42");
    await screen.findByTestId("filters");

    expect(preloadEntityItemSplit).toHaveBeenCalledWith(
      expect.objectContaining({ queryClient, apiFetch: null, profileUrl: null }),
      "invoice",
      "i-42",
    );
    expect(preloadEntityItemCollection).not.toHaveBeenCalled();
  });

  it("preloads the newly selected item when the selection changes", async () => {
    const user = userEvent.setup();
    renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("select-42"));

    await waitFor(() =>
      expect(preloadEntityItemSplit).toHaveBeenCalledWith(expect.anything(), "invoice", "i-42"),
    );
  });

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

  it("does not reuse a remembered page when the URL carries its own sort, even with no filters", async () => {
    const queryClient = new QueryClient();
    rememberCollectionPageHref(queryClient, "invoice", "https://api.example.com/invoices?p=3");

    await renderEntityRoute(queryClient, "/invoice?sort=date,desc");

    expect(await screen.findByTestId("pageUrl")).toHaveTextContent("");
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

describe("EntityItemCollectionRoute — previewed item in the URL", () => {
  it("shows the item of a deep link `?item=` as selected", async () => {
    renderEntityRoute(new QueryClient(), "/invoice?item=123");

    expect(await screen.findByTestId("selected")).toHaveTextContent("123");
  });

  it('reads a hand-written numeric `?item=42` back as the id "42", in the view and the loader', async () => {
    renderEntityRoute(new QueryClient(), "/invoice?item=42");

    expect(await screen.findByTestId("selected")).toHaveTextContent("42");
    expect(preloadEntityItemSplit).toHaveBeenCalledWith(expect.anything(), "invoice", "42");
  });

  it("shows nothing selected on a URL without `item`", async () => {
    renderEntityRoute(new QueryClient(), "/invoice");

    await screen.findByTestId("filters");
    expect(screen.getByTestId("selected")).toHaveTextContent("");
  });

  it("a selection shows at once and pushes `item=<id>`; Back removes it again", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("select-42"));

    // The view's state is mirrored synchronously, ahead of the router's async navigation.
    expect(screen.getByTestId("selected")).toHaveTextContent("i-42");
    await waitFor(() => expect(router.state.location.search).toEqual({ item: "i-42" }));

    act(() => router.history.back());

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent(""));
  });

  it("each selection is its own history entry: Back returns to the previous selection", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("select-42"));
    await waitFor(() => expect(router.state.location.search).toEqual({ item: "i-42" }));
    await user.click(screen.getByText("select-43"));
    await waitFor(() => expect(router.state.location.search).toEqual({ item: "i-43" }));

    act(() => router.history.back());

    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("i-42"));
    expect(router.state.location.search).toEqual({ item: "i-42" });
  });

  it("Close removes `item` (pushing, so Back brings the preview back)", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("close"));

    expect(screen.getByTestId("selected")).toHaveTextContent("");
    await waitFor(() => expect(router.state.location.search).toEqual({}));

    act(() => router.history.back());

    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("i-42"));
    expect(router.state.location.search).toEqual({ item: "i-42" });
  });

  it("Open goes to the item's detail page, without carrying `item` along", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("open-item"));

    expect(await screen.findByTestId("detail")).toHaveTextContent("invoice/i-42");
    expect(router.state.location.pathname).toBe("/invoice/i-42");
    expect(router.state.location.search).toEqual({});
  });

  it("keeps the filters and sort in the URL when an item is selected, and the item when they change", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(
      new QueryClient(),
      "/invoice?s.status=open&sort=date,desc",
    );
    await screen.findByTestId("filters");

    await user.click(screen.getByText("select-42"));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        "s.status": "open",
        sort: "date,desc",
        item: "i-42",
      }),
    );

    await user.click(screen.getByText("change-filters"));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        "s.status": "closed",
        sort: "date,desc",
        item: "i-42",
      }),
    );
    expect(screen.getByTestId("selected")).toHaveTextContent("i-42");
  });

  it("a change to both the search and the selection is one navigation", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("filter-and-select"));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ "s.status": "closed", item: "i-44" }),
    );

    // One Back undoes both.
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it("does not put the page position in the URL when a page is opened with an item selected", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    await screen.findByTestId("filters");

    await user.click(screen.getByText("go-next-page"));

    await waitFor(() => expect(screen.getByTestId("pageUrl")).not.toHaveTextContent(""));
    expect(router.state.location.search).toEqual({ item: "i-42" });
  });

  it("drops the selection on an entity switch", async () => {
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");

    await act(() => router.navigate({ to: "/$entity", params: { entity: "order" }, search: {} }));

    await waitFor(() => expect(screen.getByTestId("entity")).toHaveTextContent("order"));
    expect(screen.getByTestId("selected")).toHaveTextContent("");
  });

  it("a clean list URL shows no selection, and the memo neither stores nor restores `item`", async () => {
    const queryClient = new QueryClient();
    rememberCollectionFilters(queryClient, "invoice", { status: "open" });
    const { router } = renderEntityRoute(queryClient, "/invoice?s.status=open&item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");

    // Away and back, the way a breadcrumb or the sidebar does: an empty search.
    await act(() => router.navigate({ to: "/$entity", params: { entity: "order" }, search: {} }));
    await waitFor(() => expect(screen.getByTestId("entity")).toHaveTextContent("order"));
    await act(() => router.navigate({ to: "/$entity", params: { entity: "invoice" }, search: {} }));

    await waitFor(() => expect(screen.getByTestId("entity")).toHaveTextContent("invoice"));
    expect(screen.getByTestId("filters")).toHaveTextContent('{"status":"open"}');
    expect(screen.getByTestId("selected")).toHaveTextContent("");
    // The restored filters are written back; the selection is not.
    await waitFor(() => expect(router.state.location.search).toEqual({ "s.status": "open" }));
  });

  it("a clean list URL on the same entity clears the selection", async () => {
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");

    await act(() => router.navigate({ to: "/$entity", params: { entity: "invoice" }, search: {} }));

    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent(""));
  });
});

describe("EntityItemCollectionRoute — slow item preloads", () => {
  afterEach(() => {
    // `vi.clearAllMocks` keeps implementations; put the instant stub back for the other tests.
    preloadEntityItemSplit.mockReset();
    preloadEntityItemSplit.mockImplementation(async () => {});
  });

  function slowPreloads(ms: number) {
    preloadEntityItemSplit.mockImplementation(() => new Promise<void>((r) => setTimeout(r, ms)));
  }

  it("settles on the URL's item when Back supersedes a selection that is still loading", async () => {
    slowPreloads(150);
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");

    await user.click(screen.getByText("select-43"));
    act(() => router.history.back());

    await waitFor(() => expect(router.state.location.search).toEqual({ item: "i-42" }));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("i-42"), {
      timeout: 2000,
    });
    // Nothing flips it again afterwards.
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByTestId("selected")).toHaveTextContent("i-42");
    expect(router.state.location.search).toEqual({ item: "i-42" });
  });

  it("settles on the URL's item and filters when Back supersedes a selection and a filter change", async () => {
    slowPreloads(150);
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");

    await user.click(screen.getByText("select-43"));
    await user.click(screen.getByText("change-filters"));
    expect(screen.getByTestId("filters")).toHaveTextContent('{"status":"closed"}');
    // Back past both pushed entries, to the deep link's own.
    act(() => router.history.go(-2));

    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("i-42"), {
      timeout: 2000,
    });
    await waitFor(() => expect(screen.getByTestId("filters")).toHaveTextContent("{}"));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByTestId("selected")).toHaveTextContent("i-42");
    expect(screen.getByTestId("filters")).toHaveTextContent("{}");
    expect(router.state.location.search).toEqual({ item: "i-42" });
  });

  it("commits a selection's URL while the item's preload is still pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("filters");
    preloadEntityItemSplit.mockImplementation(() => pending);

    await user.click(screen.getByText("select-42"));

    // `resolvedLocation` is the committed one; `location` is already the requested one.
    await waitFor(() => expect(router.state.resolvedLocation?.search).toEqual({ item: "i-42" }));
    expect(preloadEntityItemSplit).toHaveBeenCalledWith(expect.anything(), "invoice", "i-42");
    finish();
  });
});

describe("EntityItemCollectionRoute — navigations that stay pending", () => {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  afterEach(() => {
    ensureEntityProfileLoaded.mockReset();
    ensureEntityProfileLoaded.mockImplementation(async () => {});
    preloadEntityItemDetail.mockReset();
    preloadEntityItemDetail.mockImplementation(async () => {});
  });

  it("re-syncs to the URL when Back supersedes pending navigations during a slow profile load", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    expect(await screen.findByTestId("selected")).toHaveTextContent("i-42");
    ensureEntityProfileLoaded.mockImplementation(() => delay(150));

    await user.click(screen.getByText("select-43"));
    await user.click(screen.getByText("change-filters"));
    expect(screen.getByTestId("selected")).toHaveTextContent("i-43");
    act(() => router.history.go(-2));
    await act(() => delay(800));

    expect(router.state.location.search).toEqual({ item: "i-42" });
    expect(screen.getByTestId("selected")).toHaveTextContent("i-42");
    expect(screen.getByTestId("filters")).toHaveTextContent("{}");
  });

  it("writes the full mirrored state, not a diff over a pending location", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    await screen.findByTestId("filters");
    ensureEntityProfileLoaded.mockImplementation(() => delay(150));

    // A switch to another entity is still loading when the user edits this list's filters.
    act(() => {
      void router.navigate({
        to: "/$entity",
        params: { entity: "order" },
        search: { item: "o-9", "s.prio": "high" } as never,
      });
    });
    await user.click(screen.getByText("change-filters"));
    await act(() => delay(800));

    expect(router.state.location.pathname).toBe("/invoice");
    expect(router.state.location.search).toEqual({ "s.status": "closed", item: "i-42" });
    expect(screen.getByTestId("filters")).toHaveTextContent('{"status":"closed"}');
  });

  it("keeps the previewed item when a filter change supersedes a slow Open", async () => {
    const user = userEvent.setup();
    const { router } = renderEntityRoute(new QueryClient(), "/invoice?item=i-42");
    await screen.findByTestId("filters");
    preloadEntityItemDetail.mockImplementation(() => delay(200));

    await user.click(screen.getByText("open-item"));
    await user.click(screen.getByText("change-filters"));
    await act(() => delay(500));

    expect(screen.queryByTestId("detail")).toBeNull();
    expect(screen.getByTestId("filters")).toHaveTextContent('{"status":"closed"}');
    expect(router.state.location.search).toEqual({ "s.status": "closed", item: "i-42" });
  });
});
