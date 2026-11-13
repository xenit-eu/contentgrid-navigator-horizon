/**
 * Tests for EntityItemCollectionBrowser's `pageUrl` / `filters` reconciliation.
 *
 * Covers the bug this session fixed: a remembered `pageUrl` carries whichever filters were
 * active when it was fetched, baked into its own query string. If that DIFFERS from the current
 * `filters` prop (a deep link, browser back/forward across a filter change, or a stale
 * QueryClient memo), `pageUrl` must be discarded so `searchValues` drives page 1 of the CURRENT
 * filters — never silently fetching the wrong page for what the sidebar displays.
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import { EntityItemCollectionBrowser } from "./entity-item-collection-browser";

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
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...render(<EntityItemCollectionBrowser {...props} />, { wrapper: Wrapper }),
    queryClient,
  };
}

describe("EntityItemCollectionBrowser — pageUrl / filters reconciliation", () => {
  it("fetches via searchValues when no pageUrl is given", async () => {
    setupCollectionHandler();

    renderBrowser({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    expect(await screen.findByText((text) => text.endsWith("of 2 items"))).toBeInTheDocument();
  });

  it("uses pageUrl directly when it encodes the SAME filters — preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderBrowser({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?code~prefix=abc&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    expect(await screen.findByText((text) => text.endsWith("of 5 items"))).toBeInTheDocument();
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

    expect(await screen.findByText((text) => text.endsWith("of 5 items"))).toBeInTheDocument();
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

    expect(await screen.findByText((text) => text.endsWith("of 5 items"))).toBeInTheDocument();
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
    expect(await screen.findByText((text) => text.endsWith("of 2 items"))).toBeInTheDocument();
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

    expect(await screen.findByText((text) => text.endsWith("of 5 items"))).toBeInTheDocument();
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

    await screen.findByText((text) => text.endsWith("of 2 items"));

    expect(screen.getByRole("button", { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("hides a column in the table when it's unchecked in the Columns popover", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await screen.findByText((text) => text.endsWith("of 2 items"));
    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
  });

  it("does not write the toggle to persisted preferences", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await screen.findByText((text) => text.endsWith("of 2 items"));

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(useEntityDisplayPreferencesStore.getState().overrides).toEqual({});
  });

  it("resets the local column selection on remount", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const { unmount } = renderBrowser({ profile: makeItemProfile() });

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));
    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
    unmount();

    renderBrowser({ profile: makeItemProfile() });
    await screen.findByText((text) => text.endsWith("of 2 items"));

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });

  it("keeps an actively-filtered column visible even when unchecked in the picker", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    await screen.findByText((text) => text.endsWith("of 2 items"));

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

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText(/Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Created after$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
  });

  it("renders the prefix-match search property as an autocomplete combobox", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByRole("combobox", { name: /Code/ })).toBeInTheDocument();
  });

  it("applies a typed autocomplete filter only on commit, not per keystroke", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBrowser({ profile: makeItemProfile(), onFiltersChange });

    await screen.findByText((text) => text.endsWith("of 2 items"));
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

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "42" } });

    expect(onFiltersChange).toHaveBeenCalledWith({ amount: "42" });
  });

  it("shows an already-applied filter's value pre-filled in its input", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { amount: "42" } });

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText(/Amount/)).toHaveValue(42);
  });

  it("shows an invalid-value error for a non-numeric value already applied to a number filter", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile(), filters: { amount: "not-a-number" } });

    await screen.findByText((text) => text.endsWith("of 2 items"));
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

    await screen.findByText((text) => text.endsWith("of 2 items"));
    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});

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
    expect(within(await screen.findByRole("dialog")).getByRole("region")).toBeInTheDocument();

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
    expect(await screen.findByRole("region")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveAttribute("aria-current", "true");
    // Focus stays on the row, so the next row is one Tab away.
    expect(row).toHaveFocus();

    // By keyboard: in jsdom every element is at 0,0, so a pointer press counts as one on the
    // resize handle, which then takes focus.
    within(screen.getByRole("region")).getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(row).not.toHaveAttribute("aria-current");
    expect(row).toHaveFocus();
  });

  it("closes the preview when the width crosses the side-by-side width", async () => {
    const width = stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region")).toBeInTheDocument();

    width.resize(false);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the pane when a filter drops the previewed item, and keeps it when the item still matches", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const profile = makeItemProfile();
    const { rerender } = renderBrowser({ profile });

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region")).toBeInTheDocument();

    rerender(<EntityItemCollectionBrowser profile={profile} filters={{ "code~prefix": "ABC" }} />);
    expect(await screen.findByText((text) => text.endsWith("of 1 items"))).toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();

    rerender(<EntityItemCollectionBrowser profile={profile} filters={{ "code~prefix": "XYZ" }} />);
    expect(await findRow("XYZ-1")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows the item's new values after a refetch, and closes once a refetch no longer lists it", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    const { queryClient } = renderBrowser({ profile: makeItemProfile() });

    await user.click(await findRow("ABC-0"));
    const pane = await screen.findByRole("region");

    // Edited elsewhere.
    items[0] = { id: "item-0", code: "ABC-0-edited" };
    await act(() => queryClient.invalidateQueries());
    expect(await within(pane).findAllByText("ABC-0-edited")).not.toHaveLength(0);

    // Deleted elsewhere.
    items = items.slice(1);
    await act(() => queryClient.invalidateQueries());
    await findRow("XYZ-1");
    expect(screen.queryByText("ABC-0-edited")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("closes the pane when its item is deleted from its row, not when another item is", async () => {
    stubWidth(true);
    const user = userEvent.setup();
    renderBrowser({ profile: makeItemProfile() });

    async function deleteFromRow(code: string) {
      await user.click(within(await findRow(code)).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Delete" }));
      await screen.findByText((text) => text.endsWith(`of ${items.length} items`));
    }

    await user.click(await findRow("ABC-0"));
    expect(await screen.findByRole("region")).toBeInTheDocument();

    await deleteFromRow("XYZ-1");
    expect(screen.getByRole("region")).toBeInTheDocument();

    await deleteFromRow("ABC-0");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
