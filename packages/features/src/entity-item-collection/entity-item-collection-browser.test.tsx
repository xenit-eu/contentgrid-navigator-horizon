/**
 * Tests for EntityItemCollectionBrowser's `pageUrl` / `filters` reconciliation.
 *
 * Covers the bug this session fixed: a remembered `pageUrl` carries whichever filters were
 * active when it was fetched, baked into its own query string. If that DIFFERS from the current
 * `filters` prop (a deep link, browser back/forward across a filter change, or a stale
 * QueryClient memo), `pageUrl` must be discarded so `searchValues` drives page 1 of the CURRENT
 * filters — never silently fetching the wrong page for what the sidebar displays.
 */
import { type ComponentProps, type MutableRefObject, type ReactNode, useLayoutEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import {
  API_URL as FIXTURE_API_URL,
  PROFILE_URL as FIXTURE_PROFILE_URL,
  lineItem,
  lineItemProfileHandler,
  profileRootWithRelationsHandler,
  supplierProfileHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/entity-browser-fixtures";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import { EntityItemCollectionBrowser } from "./entity-item-collection-browser";

// Records the split layout's props, and can swap its pane handle for a fake that behaves as in a
// browser: collapsed at first, expanded by `resize`, collapsed by `collapse`. jsdom has no layout,
// so the real handle never reports a collapsed pane and ignores a percentage size.
const splitLayoutSpy = vi.hoisted(() => ({
  props: undefined as { onRightCollapsedChange?: (collapsed: boolean) => void } | undefined,
  fakeHandle: undefined as unknown,
}));

vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    ResizableSplitLayout(props: ComponentProps<typeof actual.ResizableSplitLayout>) {
      splitLayoutSpy.props = props;
      // After the layout's own handle is set, so the browser's layout effect sees the fake.
      useLayoutEffect(() => {
        if (splitLayoutSpy.fakeHandle && typeof props.rightPanelRef === "object") {
          (props.rightPanelRef as MutableRefObject<unknown> | null)!.current =
            splitLayoutSpy.fakeHandle;
        }
      });
      return <actual.ResizableSplitLayout {...props} />;
    },
  };
});

function installFakePaneHandle() {
  const handle = {
    collapsed: true,
    isCollapsed: () => handle.collapsed,
    resize: vi.fn(() => {
      handle.collapsed = false;
    }),
    collapse: vi.fn(() => {
      handle.collapsed = true;
    }),
  };
  splitLayoutSpy.fakeHandle = handle;
  return handle;
}

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/items`;
const COLLECTION_URL = `${API_URL}/items`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

const itemProfileJson = {
  name: "item",
  title: "Item",
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: "",
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "code",
        title: "Code",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "code~prefix", title: "Code prefix", type: "prefix-match" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "created",
        title: "Created",
        type: "datetime",
        description: "",
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "created~after", title: "Created after", type: "greater-than" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "amount",
        title: "Amount",
        type: "double",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "amount", title: "Amount", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: PROFILE_URL, title: "Item" },
    describes: [
      { href: COLLECTION_URL, name: "collection" },
      { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "code~prefix", type: "text" },
        { name: "created~after", type: "datetime" },
        { name: "amount", type: "number" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            promptField: "prompt",
            valueField: "value",
            inline: [
              { property: "code", direction: "desc", prompt: "Code Z-A", value: "code,desc" },
            ],
          },
        },
      ],
    },
  },
};

function makeItemProfile(): ProfileEntity {
  return makeProfileEntity(itemProfileJson, PROFILE_URL, "item");
}

// A distinguishable ITEM COUNT via `total_items_exact`, so the rendered "N items" subtitle
// (from EntityItemCollectionBrowser's own `PageTitle`, built from `collection.totalItems`) tells us
// unambiguously which response actually got used.
function collectionBody(itemCount: number) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    code: `ABC-${i}`,
    _links: { self: { href: `${COLLECTION_URL}/item-${i}` } },
  }));
  return {
    _embedded: { item: items },
    _links: {
      self: { href: COLLECTION_URL },
      next: { href: `${COLLECTION_URL}?_cursor=next-token` },
    },
    page: { size: itemCount, total_items_exact: itemCount },
  };
}

// searchValues-mode requests never carry `_cursor`; url-mode requests (an explicit pageUrl)
// always do (see the fixtures below) — that alone tells the two modes apart on the wire.
const SEARCH_MODE_BODY = collectionBody(2);
const URL_MODE_BODY = collectionBody(5);

function setupCollectionHandler(onRequest?: (url: URL) => void) {
  server.use(
    http.get(COLLECTION_URL, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);
      return HttpResponse.json(url.searchParams.has("_cursor") ? URL_MODE_BODY : SEARCH_MODE_BODY);
    }),
  );
}

function renderBrowser(props: {
  profile: ProfileEntity;
  pageUrl?: string;
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
  onCreateItemClick?: () => void;
  onEntityItemClick?: (item: EntityItem) => void;
  profileUrl?: string;
}) {
  const { profileUrl = PROFILE_URL, ...browserProps } = props;
  const queryClient = new QueryClient({
    // The collection query sets its own retry count; no delay keeps a failing one quick.
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={profileUrl}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...render(<EntityItemCollectionBrowser {...browserProps} />, { wrapper: Wrapper }),
    queryClient,
  };
}

/** Resolves once the page title shows the search's total, i.e. the collection has loaded. */
async function findTotal(total: number) {
  await waitFor(() =>
    expect(document.querySelector('[data-slot="collection-count"]')).toHaveTextContent(
      new RegExp(`^${total}\\b`),
    ),
  );
}

describe("EntityItemCollectionBrowser — pageUrl / filters reconciliation", () => {
  it("fetches via searchValues when no pageUrl is given", async () => {
    setupCollectionHandler();

    renderBrowser({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    await findTotal(2);
  });

  it("uses pageUrl directly when it encodes the SAME filters — preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderBrowser({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?code~prefix=abc&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    await findTotal(5);
    expect(onRequest).toHaveBeenCalled();
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("uses pageUrl directly for a datetime filter — same instant, different string encoding, preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderBrowser({
      profile: makeItemProfile(),
      // What FilterSidebar.encodeDateInputValue produces from the datetime-local input (no
      // milliseconds) — the raw sidebar string never round-trips byte-for-byte through the
      // HAL-FORMS encoder, which re-serializes via Date#toISOString() (always ".000Z").
      filters: { "created~after": "2024-01-01T10:00:00Z" },
      pageUrl: `${COLLECTION_URL}?created~after=2024-01-01T10:00:00.000Z&_cursor=page2token`,
    });

    await findTotal(5);
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("uses pageUrl directly for a number filter — same value, different string encoding, preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderBrowser({
      profile: makeItemProfile(),
      // What the user typed into the sidebar input; the HAL-FORMS encoder re-serializes the
      // coerced `number` via `"" + value`, which normalizes "10.50" down to "10.5".
      filters: { amount: "10.50" },
      pageUrl: `${COLLECTION_URL}?amount=10.5&_cursor=page2token`,
    });

    await findTotal(5);
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("discards pageUrl when its encoded filters DIFFER from the given filters", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderBrowser({
      profile: makeItemProfile(),
      // Encodes a different filter value ("zzz") than what's actually active ("abc") — e.g. a
      // stale QueryClient memo, a deep link, or browser back/forward across a filter change.
      pageUrl: `${COLLECTION_URL}?code~prefix=zzz&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    // Falls back to searchValues (page 1 of the CURRENT filters), not the mismatched page.
    await findTotal(2);
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBeNull();
    expect(requested.searchParams.get("code~prefix")).toBe("abc");
  });

  it("uses pageUrl as-is when filters is omitted and pageUrl encodes no filters", async () => {
    setupCollectionHandler();

    renderBrowser({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?_cursor=page2token`,
      // filters omitted entirely — defaults to {}, which matches what this pageUrl encodes (none).
    });

    await findTotal(5);
  });
});

describe("EntityItemCollectionBrowser — Columns selector", () => {
  afterEach(() => {
    localStorage.clear();
    useEntityDisplayPreferencesStore.setState({ overrides: {} });
  });

  it("renders a Columns button next to Filters", async () => {
    setupCollectionHandler();
    renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);

    expect(screen.getByRole("button", { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("hides a column in the table when it's unchecked in the Columns popover", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);
    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
  });

  it("does not write the toggle to persisted preferences", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(useEntityDisplayPreferencesStore.getState().overrides).toEqual({});
  });

  it("resets the local column selection on remount", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const { unmount } = renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));
    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
    unmount();

    renderBrowser({ profile: makeItemProfile() });
    await findTotal(2);

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });

  it("keeps an actively-filtered column visible even when unchecked in the picker", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    await findTotal(2);

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });
});

describe("EntityItemCollectionBrowser — filter form (HalFormsContainer)", () => {
  it("renders a labeled input for every search property when Filters opens", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText(/Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Created after$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
  });

  it("renders the prefix-match search property as an autocomplete combobox", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByRole("combobox", { name: /Code/ })).toBeInTheDocument();
  });

  it("applies a typed autocomplete filter only on commit, not per keystroke", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBrowser({ profile: makeItemProfile(), onFiltersChange });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));
    const combobox = screen.getByRole("combobox", { name: /Code/ });
    await user.type(combobox, "abc");

    expect(onFiltersChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenCalledWith({ "code~prefix": "abc" });
  });

  it("reports a typed number filter value back through onFiltersChange", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBrowser({ profile: makeItemProfile(), onFiltersChange });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "42" } });

    expect(onFiltersChange).toHaveBeenCalledWith({ amount: "42" });
  });

  it("shows an already-applied filter's value pre-filled in its input", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { amount: "42" } });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText(/Amount/)).toHaveValue(42);
  });

  it("shows an invalid-value error for a non-numeric value already applied to a number filter", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { amount: "not-a-number" } });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByText(/Enter a valid number/i)).toBeInTheDocument();
  });

  it("clears every filter when Clear all is clicked", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBrowser({
      profile: makeItemProfile(),
      filters: { amount: "42" },
      onFiltersChange,
    });

    await findTotal(2);
    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});

describe("EntityItemCollectionBrowser — empty collection", () => {
  function emptyCollectionBody(links: Record<string, { href: string }> = {}) {
    return {
      _embedded: { item: [] },
      _links: { self: { href: COLLECTION_URL }, ...links },
      page: { size: 0, total_items_exact: 0 },
    };
  }

  function setupEmptyCollectionHandler(links?: Record<string, { href: string }>) {
    const body = emptyCollectionBody(links);
    server.use(http.get(COLLECTION_URL, () => HttpResponse.json(body)));
  }

  const emptyStateHeading = (profile: ProfileEntity) => ({
    name: `No ${profile.pluralName} found`,
  });

  it("shows the empty state instead of the search bar and table on an unfiltered first page", async () => {
    setupEmptyCollectionHandler();
    const profile = makeItemProfile();

    renderBrowser({ profile, onFiltersChange: vi.fn() });

    expect(await screen.findByRole("heading", emptyStateHeading(profile))).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filters/ })).not.toBeInTheDocument();
  });

  it("offers create in the empty state when the profile has a create form", async () => {
    setupEmptyCollectionHandler();
    const createForm = { method: "POST", target: COLLECTION_URL, properties: [] };
    const profile = makeProfileEntity(
      {
        ...itemProfileJson,
        _templates: { ...itemProfileJson._templates, "create-form": createForm },
      },
      PROFILE_URL,
      "item",
    );

    renderBrowser({ profile, onCreateItemClick: vi.fn() });

    expect(
      await screen.findByRole("button", { name: `Create ${profile.singularName}` }),
    ).toBeInTheDocument();
  });

  it("offers no create in the empty state when the profile has no create form", async () => {
    setupEmptyCollectionHandler();
    const profile = makeItemProfile();

    renderBrowser({ profile, onCreateItemClick: vi.fn() });

    expect(await screen.findByRole("heading", emptyStateHeading(profile))).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Create ${profile.singularName}` }),
    ).not.toBeInTheDocument();
  });

  it("keeps the table when filters are active", async () => {
    setupEmptyCollectionHandler();
    const profile = makeItemProfile();

    renderBrowser({ profile, filters: { "code~prefix": "zzz" } });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("heading", emptyStateHeading(profile))).not.toBeInTheDocument();
  });

  it("keeps the table on a page that has a previous page", async () => {
    setupEmptyCollectionHandler({ prev: { href: `${COLLECTION_URL}?_cursor=prev-token` } });
    const profile = makeItemProfile();

    renderBrowser({ profile });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("heading", emptyStateHeading(profile))).not.toBeInTheDocument();
  });

  it("does not show the empty state while clearing filters, before the unfiltered result arrives", async () => {
    let releaseUnfiltered!: () => void;
    const unfilteredReleased = new Promise<void>((resolve) => {
      releaseUnfiltered = resolve;
    });
    server.use(
      http.get(COLLECTION_URL, async ({ request }) => {
        if (new URL(request.url).searchParams.has("code~prefix")) {
          return HttpResponse.json(emptyCollectionBody());
        }
        await unfilteredReleased;
        return HttpResponse.json(SEARCH_MODE_BODY);
      }),
    );
    const profile = makeItemProfile();
    const { rerender } = renderBrowser({ profile, filters: { "code~prefix": "zzz" } });
    expect(await screen.findByRole("table")).toBeInTheDocument();

    rerender(<EntityItemCollectionBrowser profile={profile} filters={{}} />);

    expect(screen.queryByRole("heading", emptyStateHeading(profile))).not.toBeInTheDocument();
    releaseUnfiltered();
    await findTotal(2);
  });
});

// The table is a region too, and so are the item's sections inside the pane; the pane is the
// region not named after the table and not inside another region.
const paneRegion = {
  name: (name: string, element: Element) =>
    !name.endsWith(" table") && element.parentElement?.closest('[role="region"]') === null,
};

describe("EntityItemCollectionBrowser — item preview", () => {
  // The listed items, filtered by `code~prefix`; a DELETE removes one.
  let items: { id: string; code: string }[];

  beforeEach(() => {
    items = [
      { id: "item-0", code: "ABC-0" },
      { id: "item-1", code: "XYZ-1" },
    ];
    server.use(
      // The pane loads the profiles its relations link to; this entity has no relations.
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
      http.get(COLLECTION_URL, ({ request }) => {
        const prefix = new URL(request.url).searchParams.get("code~prefix");
        const shown = items.filter((item) => !prefix || item.code.startsWith(prefix));
        return HttpResponse.json({
          _embedded: {
            item: shown.map((item) => {
              const href = `${COLLECTION_URL}/${item.id}`;
              return {
                ...item,
                _links: { self: { href } },
                _templates: { delete: { method: "DELETE", target: href, properties: [] } },
              };
            }),
          },
          _links: { self: { href: COLLECTION_URL } },
          page: { size: shown.length, total_items_exact: shown.length },
        });
      }),
      http.delete(`${COLLECTION_URL}/:id`, ({ params }) => {
        items = items.filter((item) => item.id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  // jsdom lays nothing out, so every element is 0 px wide and the browser is narrow. This makes it
  // `wide` (at least `--container-side-by-side`) or not, and `resize` changes it the way resizing
  // the window or closing the sidebar would.
  function stubWidth(wide: boolean) {
    let width = wide ? 880 : 879;
    const callbacks = new Set<ResizeObserverCallback>();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          callbacks.add(this.callback);
        }
        unobserve() {}
        disconnect() {
          callbacks.delete(this.callback);
        }
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    // jsdom has no default font size in pixels, as a browser has.
    document.documentElement.style.fontSize = "16px";
    document.documentElement.style.setProperty("--container-side-by-side", "55rem");
    return {
      resize(toWide: boolean) {
        width = toWide ? 880 : 879;
        act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
      },
    };
  }

  afterEach(() => {
    splitLayoutSpy.fakeHandle = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty("font-size");
    document.documentElement.style.removeProperty("--container-side-by-side");
  });

  async function findRow(code: string) {
    // The code shows in both the reference and the Code column.
    // The collection table is the first; the pane's attributes may add another.
    const [table] = await screen.findAllByRole("table");
    const [cell] = await within(table).findAllByText(code);
    return cell.closest<HTMLElement>('[role="row"]')!;
  }

  it("previews a clicked row in a dialog when narrow, and gives focus back to the row on Escape", async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    await user.click(row);
    expect(
      within(await screen.findByRole("dialog")).getByRole("region", paneRegion),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it("previews a row beside the table when wide, marks it current, and gives focus back on Close", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    row.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveAttribute("aria-current", "true");
    // Focus stays on the row, so the next row is one Tab away.
    expect(row).toHaveFocus();

    // By keyboard: in jsdom every element is at 0,0, so a pointer press counts as one on the
    // resize handle, which then takes focus.
    within(screen.getByRole("region", paneRegion)).getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
    expect(row).not.toHaveAttribute("aria-current");
    expect(row).toHaveFocus();
  });

  it("lets the page scroll, with a sticky header, while no pane is open", async () => {
    stubWidth(false);
    renderBrowser({ profile: makeItemProfile() });

    await findRow("ABC-0");
    const table = screen.getByRole("table");
    expect(table.firstElementChild).toHaveClass("sticky");
    // Not as tall as its parent: the page scrolls, the table has no scroll of its own.
    expect(screen.getByRole("region", { name: /table$/ })).not.toHaveClass("h-full");
  });

  it("keeps the table as tall as the pane, with its own scroll, while the wide pane is open, without remounting it", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    const table = screen.getByRole("table");
    expect(table.firstElementChild).toHaveClass("sticky");
    expect(splitLayoutSpy.props).toMatchObject({ fitContentHeight: true });

    row.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();
    expect(splitLayoutSpy.props).toMatchObject({ fitContentHeight: false });
    expect(table.firstElementChild).not.toHaveClass("sticky");
    expect(screen.getByRole("region", { name: /table$/ })).toHaveClass("h-full");

    within(screen.getByRole("region", paneRegion)).getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(table.firstElementChild).toHaveClass("sticky"));
    // The same table element throughout: opening and closing the pane never remounts it.
    expect(screen.getByRole("table")).toBe(table);
  });

  it("keeps the previewed row in view when the pane switches the table's scroll, in both directions", async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    row.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("region", paneRegion);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(row);

    within(screen.getByRole("region", paneRegion)).getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument());
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts[1]).toBe(row);
    Element.prototype.scrollIntoView = original;
  });

  it("does not move the scroll when a narrow preview opens in a dialog", async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    stubWidth(false);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    row.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog");
    expect(scrollIntoView).not.toHaveBeenCalled();
    Element.prototype.scrollIntoView = original;
  });

  it("closes the preview when the width crosses the side-by-side width", async () => {
    const width = stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();

    width.resize(false);
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the pane when a filter drops the previewed item, and keeps it when the item still matches", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const profile = makeItemProfile();
    const { rerender } = renderBrowser({ profile });

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();

    rerender(<EntityItemCollectionBrowser profile={profile} filters={{ "code~prefix": "ABC" }} />);
    await findTotal(1);
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();

    rerender(<EntityItemCollectionBrowser profile={profile} filters={{ "code~prefix": "XYZ" }} />);
    expect(await findRow("XYZ-1")).toBeInTheDocument();
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
  });

  it("shows the item's new values after a refetch, and closes once a refetch no longer lists it", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const { queryClient } = renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region", paneRegion);

    // Edited elsewhere.
    items[0] = { id: "item-0", code: "ABC-0-edited" };
    await act(() => queryClient.invalidateQueries());
    expect(await within(pane).findAllByText("ABC-0-edited")).not.toHaveLength(0);

    // Deleted elsewhere.
    items = items.slice(1);
    await act(() => queryClient.invalidateQueries());
    await findRow("XYZ-1");
    expect(screen.queryByText("ABC-0-edited")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
  });

  it("closes the pane when its item is deleted from its row, not when another item is", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    async function deleteFromRow(code: string) {
      // By keyboard: in jsdom nothing has a size, so the pane's resize handle takes every pointer
      // press (react-resizable-panels thinks the pointer is on it) and the menu never opens.
      within(await findRow(code))
        .getByRole("button", { name: `Actions for ${code}` })
        .focus();
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Delete" }));
      // The last delete leaves an empty collection, which shows the empty state instead.
      await (items.length > 0
        ? waitFor(() => {
            const [table] = screen.getAllByRole("table");
            expect(within(table).getAllByRole("row")).toHaveLength(items.length + 1);
          })
        : screen.findByRole("heading", { name: /^No .+ found$/ }));
    }

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();

    await deleteFromRow("XYZ-1");
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();

    await deleteFromRow("ABC-0");
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("previews a row when %s is pressed on it", async (_, key) => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    row.focus();
    await user.keyboard(key);
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();
    expect(row).toHaveAttribute("aria-current", "true");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "opens the item's page without previewing when %s is pressed on a row menu's Open item",
    async (_, key) => {
      stubWidth(true);
      const user = userEvent.setup();
      const onEntityItemClick = vi.fn();
      renderBrowser({ profile: makeItemProfile(), onEntityItemClick });

      const row = await findRow("ABC-0");
      row.focus();
      // The title button comes first, then the row menu's button.
      await user.tab();
      await user.tab();
      expect(within(row).getByRole("button", { name: "Actions for ABC-0" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
      expect(onEntityItemClick).not.toHaveBeenCalled();
      // Opening it with the keyboard focuses its first item.
      await user.keyboard(key);

      expect(onEntityItemClick).toHaveBeenCalledOnce();
      expect(onEntityItemClick.mock.calls[0][0].id).toBe("item-0");
      expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
      expect(row).not.toHaveAttribute("aria-current");
    },
  );

  it("shows no Open item without onEntityItemClick, and a row still previews", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    expect(screen.queryByRole("menuitem", { name: "Open" })).not.toBeInTheDocument();
    await user.click(row);
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();
  });

  it("closes the pane when a sort or page change shows a page without the previewed item", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const profile = makeItemProfile();
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        // A later page, or the list sorted so that the first item falls off the page.
        const shown = params.has("_cursor") || params.has("_sort") ? items.slice(1) : items;
        return HttpResponse.json({
          _embedded: {
            item: shown.map((item) => ({
              ...item,
              _links: { self: { href: `${COLLECTION_URL}/${item.id}` } },
            })),
          },
          _links: { self: { href: COLLECTION_URL } },
          page: { size: shown.length, total_items_exact: shown.length },
        });
      }),
    );
    const { rerender } = renderBrowser({ profile });

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();

    rerender(
      <EntityItemCollectionBrowser
        profile={profile}
        pageUrl={`${COLLECTION_URL}?_cursor=page-2`}
      />,
    );
    expect(await findRow("XYZ-1")).toBeInTheDocument();
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();

    // Back on the first page, previewing the first item again, then a sort that drops it.
    rerender(<EntityItemCollectionBrowser profile={profile} />);
    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region", paneRegion)).toBeInTheDocument();
    rerender(<EntityItemCollectionBrowser profile={profile} currentSort="code,desc" />);
    expect(await screen.findAllByText("XYZ-1")).not.toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument());
  });

  it("keeps the pane's item when a sort change still lists it", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const profile = makeItemProfile();
    const { rerender } = renderBrowser({ profile });

    await user.click(await findRow("ABC-0"));
    rerender(<EntityItemCollectionBrowser profile={profile} currentSort="code,desc" />);
    await findRow("XYZ-1");
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();
  });

  it("does nothing on Escape with focus on a row, and leaves an Escape an inner control handled", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    await user.click(row);
    const pane = await screen.findByRole("region", paneRegion);
    row.focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();

    // An open select or dropdown inside the pane prevents the default when it closes itself.
    const close = within(pane).getByRole("button", { name: "Close" });
    close.addEventListener("keydown", (event) => event.preventDefault());
    close.focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();
  });

  it("moves focus to the table when the pane closes with its row gone", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const { queryClient } = renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region", paneRegion);
    within(pane).getByRole("button", { name: "Close" }).focus();

    // Deleted elsewhere: the pane closes and takes its focus with it.
    items = items.slice(1);
    await act(() => queryClient.invalidateQueries());
    await findRow("XYZ-1");
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /table$/ })).toHaveFocus();
  });

  it("has no separator while nothing is previewed, and a named one while the pane is open", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await findRow("ABC-0");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region", paneRegion);
    expect(screen.getByRole("separator", { name: "Resize preview" })).toBeInTheDocument();

    await user.click(within(pane).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("expands the pane when a row is previewed and collapses it when it closes", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const handle = installFakePaneHandle();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region", paneRegion);
    expect(handle.resize).toHaveBeenCalledWith("45%");
    expect(handle.collapse).not.toHaveBeenCalled();

    await user.click(within(pane).getByRole("button", { name: "Close" }));
    expect(handle.collapse).toHaveBeenCalledOnce();
  });

  it("closes the preview when the pane is dragged shut, not when it is expanded", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    installFakePaneHandle();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    await screen.findByRole("region", paneRegion);

    act(() => splitLayoutSpy.props!.onRightCollapsedChange!(false));
    expect(screen.getByRole("region", paneRegion)).toBeInTheDocument();

    act(() => splitLayoutSpy.props!.onRightCollapsedChange!(true));
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
  });

  it("gives focus back to the row when the pane is collapsed from its handle", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    installFakePaneHandle();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    await user.click(row);
    await screen.findByRole("region", paneRegion);
    screen.getByRole("separator", { name: "Resize preview" }).focus();
    expect(row).not.toHaveFocus();

    act(() => splitLayoutSpy.props!.onRightCollapsedChange!(true));
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it("has no tabs for an entity without content attributes, and shows its attributes directly", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region", paneRegion);

    expect(within(pane).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(pane).getByText("Code")).toBeInTheDocument();
  });

  it("leaves focus where it is when the pane closes without focus inside it", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const { queryClient } = renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    await screen.findByRole("region", paneRegion);
    // The user clicked empty page space: focus is on the body.
    act(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    expect(document.body).toHaveFocus();

    items = items.slice(1);
    await act(() => queryClient.invalidateQueries());
    await findRow("XYZ-1");
    expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it("names the narrow dialog after the item, like the pane's region", async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const dialog = await screen.findByRole("dialog", { name: /ABC-0/ });
    expect(within(dialog).getByRole("region", { name: /ABC-0/ })).toBeInTheDocument();
    expect(dialog).toHaveFocus();
  });

  it("keeps the item in the narrow dialog while it animates closed", async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const dialog = await screen.findByRole("dialog", { name: /ABC-0/ });

    // jsdom plays no animation, so the dialog would unmount at once. Report one on it, which
    // makes Radix wait for an animationend that never comes.
    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = realGetComputedStyle(element, pseudo);
      return element === dialog
        ? new Proxy(style, {
            get: (target, prop) =>
              prop === "animationName" ? "closing" : Reflect.get(target, prop),
          })
        : style;
    });

    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: /ABC-0/ })).toBeInTheDocument();
  });

  it("closes the dialog when the user clicks outside it", async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    const row = await findRow("ABC-0");
    await user.click(row);
    await screen.findByRole("dialog");

    await user.click(document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  describe("with content attributes and relations", () => {
    const INVOICES_URL = `${FIXTURE_API_URL}/invoices`;
    const INVOICES_PROFILE_URL = `${FIXTURE_PROFILE_URL}/invoices`;
    const CG = "https://contentgrid.cloud/rels/contentgrid";
    const BLUEPRINT = "https://contentgrid.cloud/rels/blueprint";

    const contentAttribute = (name: string, title: string) => ({
      name,
      title,
      type: "object",
      description: null,
      readOnly: false,
      _embedded: {
        "blueprint:constraint": [],
        "blueprint:search-param": [],
        "blueprint:attribute": [
          {
            name: "filename",
            title: "Filename",
            type: "string",
            description: null,
            readOnly: true,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
        ],
      },
      _links: {},
    });

    const invoiceProfileJson = {
      name: "invoice",
      title: "Invoice",
      description: null,
      _links: {
        self: { href: INVOICES_PROFILE_URL },
        describes: [
          { href: INVOICES_URL, name: "collection" },
          { href: `${INVOICES_URL}/{id}`, name: "item", templated: true },
        ],
        curies: [{ name: "blueprint", href: `${BLUEPRINT}/{rel}`, templated: true }],
      },
      _embedded: {
        "blueprint:attribute": [
          {
            name: "id",
            title: "id",
            type: "string",
            description: null,
            readOnly: true,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
          {
            name: "number",
            title: "Number",
            type: "string",
            description: null,
            readOnly: false,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
          contentAttribute("contract", "Contract"),
          contentAttribute("receipt", "Receipt"),
        ],
        [`${BLUEPRINT}/relation`]: [
          {
            name: "lineItems",
            title: "Line Items",
            description: null,
            required: false,
            many_source_per_target: false,
            many_target_per_source: true,
            _links: {
              self: { href: `${INVOICES_PROFILE_URL}/relations/lineItems` },
              [`${BLUEPRINT}/target-entity`]: {
                href: `${FIXTURE_PROFILE_URL}/line-items`,
                name: "lineItem",
              },
            },
          },
        ],
      },
      _templates: { search: { method: "GET", target: INVOICES_URL, properties: [] } },
    };

    // The metadata every listed invoice has for its `contract`; null is no file.
    let contract: { filename: string; mimetype: string; length: number } | null = null;
    beforeEach(() => {
      contract = null;
      // jsdom has no Blob URLs, which the image viewer needs.
      URL.createObjectURL = vi.fn(() => "blob:mock-url");
      URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => {
      // @ts-expect-error -- removing the jsdom-absent methods stubbed above, not a spy.
      delete URL.createObjectURL;
      // @ts-expect-error -- see above.
      delete URL.revokeObjectURL;
    });

    // By keyboard: in jsdom a pointer press counts as one on the resize handle, which takes focus.
    async function showDetails(pane: HTMLElement) {
      await act(async () => within(pane).getByRole("tab", { name: "Details" }).focus());
    }

    function serveInvoices() {
      server.use(
        profileRootWithRelationsHandler(),
        http.get(INVOICES_PROFILE_URL, () => HttpResponse.json(invoiceProfileJson)),
        supplierProfileHandler(),
        lineItemProfileHandler(),
        http.get(INVOICES_URL, () => {
          const invoice = (id: string) => {
            const href = `${INVOICES_URL}/${id}`;
            return {
              id,
              number: `INV-${id}`,
              // Attributes without a file: nothing to fetch or render in the viewer.
              contract,
              receipt: null,
              _links: {
                self: { href },
                [`${CG}/content`]: [
                  { href: `${href}/contract`, name: "contract" },
                  { href: `${href}/receipt`, name: "receipt" },
                ],
                [`${CG}/relation`]: [{ href: `${href}/lineItems`, name: "lineItems" }],
              },
              _templates: {
                delete: { method: "DELETE", target: href, properties: [] },
                "add-lineItems": {
                  method: "POST",
                  target: `${href}/lineItems`,
                  contentType: "text/uri-list",
                  properties: [{ name: "lineItem", type: "url", options: {} }],
                },
                "clear-lineItems": {
                  method: "DELETE",
                  target: `${href}/lineItems`,
                  properties: [],
                },
              },
            };
          };
          return HttpResponse.json({
            _embedded: { invoice: [invoice("1"), invoice("2")] },
            _links: { self: { href: INVOICES_URL } },
            page: { size: 2, total_items_exact: 2 },
          });
        }),
        http.get(`${INVOICES_URL}/:id/lineItems`, () =>
          HttpResponse.json({
            _embedded: { lineItem: [lineItem("l1", "Widget", true)] },
            _links: { self: { href: `${INVOICES_URL}/1/lineItems` } },
            page: { size: 1, total_items_exact: 1 },
          }),
        ),
      );
      return makeProfileEntity(invoiceProfileJson, INVOICES_PROFILE_URL, "invoice");
    }

    it("keeps the chosen content attribute and the Details tab when another row is clicked", async () => {
      stubWidth(true);
      const user = userEvent.setup();
      renderBrowser({ profile: serveInvoices(), profileUrl: FIXTURE_PROFILE_URL });

      await user.click(await findRow("INV-1"));
      const pane = await screen.findByRole("region", paneRegion);

      within(pane).getByRole("combobox").focus();
      await user.keyboard("{Enter}{ArrowDown}{Enter}");
      expect(await within(pane).findByRole("combobox")).toHaveTextContent("Receipt");

      await user.click(await findRow("INV-2"));
      const next = screen.getByRole("region", paneRegion);
      expect(within(next).getByRole("combobox")).toHaveTextContent("Receipt");

      await showDetails(next);
      await user.click(await findRow("INV-1"));
      expect(
        within(screen.getByRole("region", paneRegion)).getByRole("tab", { name: "Details" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("starts on the Preview tab, with Details next to it", async () => {
      stubWidth(true);
      const user = userEvent.setup();
      renderBrowser({ profile: serveInvoices(), profileUrl: FIXTURE_PROFILE_URL });

      await user.click(await findRow("INV-1"));
      const pane = await screen.findByRole("region", paneRegion);

      const tabs = within(pane).getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Preview", "Details"]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    });

    it("keeps the preview mounted, but inert, while Details is shown", async () => {
      stubWidth(true);
      const user = userEvent.setup();
      renderBrowser({ profile: serveInvoices(), profileUrl: FIXTURE_PROFILE_URL });

      await user.click(await findRow("INV-1"));
      const pane = await screen.findByRole("region", paneRegion);
      const previewPanel = within(pane).getByRole("tabpanel");
      expect(previewPanel).not.toHaveAttribute("inert");

      await showDetails(pane);
      await user.keyboard("{Enter}");

      expect(within(pane).getByRole("tab", { name: "Details" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(previewPanel).toBeInTheDocument();
      expect(previewPanel).toHaveAttribute("inert");
    });

    it("downloads the file again only when a refetch changes its metadata", async () => {
      stubWidth(true);
      let downloads = 0;
      contract = { filename: "scan.png", mimetype: "image/png", length: 4 };
      const user = userEvent.setup();
      const { queryClient } = renderBrowser({
        profile: serveInvoices(),
        profileUrl: FIXTURE_PROFILE_URL,
      });
      server.use(
        http.get(`${INVOICES_URL}/1/contract`, () => {
          downloads += 1;
          return new HttpResponse(new Uint8Array([1, 2, 3, 4]), {
            headers: { "Content-Type": "image/png" },
          });
        }),
      );
      // Refetches the list but not the content preview's own query.
      const refetchList = () =>
        act(() =>
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] !== "ContentPreview",
          }),
        );

      await user.click(await findRow("INV-1"));
      await screen.findByRole("region", paneRegion);
      await waitFor(() => expect(downloads).toBe(1));

      // Same metadata: the list has a new item object, but the file is the same.
      await refetchList();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(downloads).toBe(1);

      // The file was replaced elsewhere.
      contract = { filename: "scan.png", mimetype: "image/png", length: 5 };
      await refetchList();
      await waitFor(() => expect(downloads).toBe(2));
    });

    it("closes the pane with Escape from inside it and gives focus back to the row", async () => {
      stubWidth(true);
      const user = userEvent.setup();
      renderBrowser({ profile: serveInvoices(), profileUrl: FIXTURE_PROFILE_URL });

      const row = await findRow("INV-1");
      await user.click(row);
      const pane = await screen.findByRole("region", paneRegion);
      within(pane).getByRole("tab", { name: "Details" }).focus();
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("region", paneRegion)).not.toBeInTheDocument();
      expect(row).toHaveFocus();
    });

    it("shows the relations on the Details tab without any action, and related items are not links", async () => {
      stubWidth(true);
      const user = userEvent.setup();
      renderBrowser({ profile: serveInvoices(), profileUrl: FIXTURE_PROFILE_URL });

      await user.click(await findRow("INV-1"));
      const pane = await screen.findByRole("region", paneRegion);
      await showDetails(pane);

      await user.click(within(pane).getByRole("button", { name: /Line Items/ }));
      expect(await within(pane).findByText("Widget")).toBeInTheDocument();

      for (const name of [/^Link$/, /^Unlink$/, /unlink all/i, /^Delete$/]) {
        expect(within(pane).queryByRole("button", { name })).not.toBeInTheDocument();
      }
      expect(within(pane).queryByRole("link")).not.toBeInTheDocument();
      expect(within(pane).getByText("Widget").closest("a")).toBeNull();
    });
  });
});

describe("EntityItemCollectionBrowser — loading", () => {
  /** Answers the collection once `release` is called; until then the request stays open. */
  function holdCollection() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(COLLECTION_URL, async () => {
        await released;
        return HttpResponse.json(SEARCH_MODE_BODY);
      }),
    );
    return release;
  }

  it("shows the headers over skeleton rows, busy, until the first page arrives", async () => {
    const release = holdCollection();
    renderBrowser({ profile: makeItemProfile() });

    const region = screen.getByRole("region", { name: /table$/ });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).getAllByRole("columnheader").length).toBeGreaterThan(1);
    // One page of placeholder rows: the platform's default page size, 20.
    expect(region.querySelectorAll("[data-slot='table-row'] [data-slot='skeleton']")).toHaveLength(
      20 * within(region).getAllByRole("columnheader").length,
    );
    expect(document.querySelector("[data-slot='collection-count-skeleton']")).toBeInTheDocument();

    release();
    await findTotal(2);
    expect(region).not.toHaveAttribute("aria-busy");
    expect(region.querySelector("[data-slot='skeleton']")).toBeNull();
    expect(document.querySelector("[data-slot='collection-count-skeleton']")).toBeNull();
  });

  it("keeps the previous rows, dimmed, while a new search loads", async () => {
    setupCollectionHandler();
    const view = renderBrowser({ profile: makeItemProfile() });
    await findTotal(2);
    const rows = () => [...document.querySelectorAll("[data-slot='table-row']")];
    expect(rows()).toHaveLength(2);
    expect(rows().every((row) => !row.classList.contains("opacity-45"))).toBe(true);

    const release = holdCollection();
    view.rerender(
      <EntityItemCollectionBrowser
        profile={makeItemProfile()}
        filters={{ "code~prefix": "abc" }}
      />,
    );

    await waitFor(() =>
      expect(rows().every((row) => row.classList.contains("opacity-45"))).toBe(true),
    );
    expect(rows()).toHaveLength(2);

    release();
    await waitFor(() =>
      expect(rows().every((row) => !row.classList.contains("opacity-45"))).toBe(true),
    );
  });
});

describe("EntityItemCollectionBrowser — failed to load", () => {
  function problem(body: Record<string, unknown>, status = 400) {
    return HttpResponse.json(body, {
      status,
      headers: { "Content-Type": "application/problem+json" },
    });
  }

  it("with no answer, says to check the connection; Try again fetches the page again", async () => {
    let failing = true;
    server.use(
      http.get(COLLECTION_URL, () =>
        failing ? HttpResponse.error() : HttpResponse.json(SEARCH_MODE_BODY),
      ),
    );
    renderBrowser({ profile: makeItemProfile() });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/The item couldn't be loaded/);
    expect(alert).toHaveTextContent("Check your connection and try again.");

    failing = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    await findTotal(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the problem's detail when the server answered with one", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        problem({
          title: "Bad filter",
          detail: "The filter value is not a valid date.",
          status: 400,
        }),
      ),
    );
    renderBrowser({ profile: makeItemProfile() });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The filter value is not a valid date.");
    expect(alert).not.toHaveTextContent("Check your connection");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("falls back to the problem's title without a detail", async () => {
    server.use(http.get(COLLECTION_URL, () => problem({ title: "Service unavailable" }, 503)));
    renderBrowser({ profile: makeItemProfile() });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service unavailable");
    expect(alert).not.toHaveTextContent("Check your connection");
  });
});
