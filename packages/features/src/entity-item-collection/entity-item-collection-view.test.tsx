/**
 * Tests for EntityItemCollectionView's `pageUrl` / `filters` reconciliation.
 *
 * Covers the bug this session fixed: a remembered `pageUrl` carries whichever filters were
 * active when it was fetched, baked into its own query string. If that DIFFERS from the current
 * `filters` prop (a deep link, browser back/forward across a filter change, or a stale
 * QueryClient memo), `pageUrl` must be discarded so `searchValues` drives page 1 of the CURRENT
 * filters — never silently fetching the wrong page for what the sidebar displays.
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { EntityItemCollectionView } from "./entity-item-collection-view";

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
// (from EntityItemCollectionView's own `PageTitle`, built from `collection.totalItems`) tells us
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

function renderCollectionView(props: {
  profile: ProfileEntity;
  pageUrl?: string;
  filters?: Record<string, string>;
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

  return render(<EntityItemCollectionView {...props} />, { wrapper: Wrapper });
}

describe("EntityItemCollectionView — pageUrl / filters reconciliation", () => {
  it("fetches via searchValues when no pageUrl is given", async () => {
    setupCollectionHandler();

    renderCollectionView({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    expect(await screen.findByText((text) => text.startsWith("2 items"))).toBeInTheDocument();
  });

  it("uses pageUrl directly when it encodes the SAME filters — preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderCollectionView({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?code~prefix=abc&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    expect(await screen.findByText((text) => text.startsWith("5 items"))).toBeInTheDocument();
    expect(onRequest).toHaveBeenCalled();
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("uses pageUrl directly for a datetime filter — same instant, different string encoding, preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderCollectionView({
      profile: makeItemProfile(),
      // What FilterSidebar.encodeDateInputValue produces from the datetime-local input (no
      // milliseconds) — the raw sidebar string never round-trips byte-for-byte through the
      // HAL-FORMS encoder, which re-serializes via Date#toISOString() (always ".000Z").
      filters: { "created~after": "2024-01-01T10:00:00Z" },
      pageUrl: `${COLLECTION_URL}?created~after=2024-01-01T10:00:00.000Z&_cursor=page2token`,
    });

    expect(await screen.findByText((text) => text.startsWith("5 items"))).toBeInTheDocument();
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("uses pageUrl directly for a number filter — same value, different string encoding, preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderCollectionView({
      profile: makeItemProfile(),
      // What the user typed into the sidebar input; the HAL-FORMS encoder re-serializes the
      // coerced `number` via `"" + value`, which normalizes "10.50" down to "10.5".
      filters: { amount: "10.50" },
      pageUrl: `${COLLECTION_URL}?amount=10.5&_cursor=page2token`,
    });

    expect(await screen.findByText((text) => text.startsWith("5 items"))).toBeInTheDocument();
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBe("page2token");
  });

  it("discards pageUrl when its encoded filters DIFFER from the given filters", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderCollectionView({
      profile: makeItemProfile(),
      // Encodes a different filter value ("zzz") than what's actually active ("abc") — e.g. a
      // stale QueryClient memo, a deep link, or browser back/forward across a filter change.
      pageUrl: `${COLLECTION_URL}?code~prefix=zzz&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    // Falls back to searchValues (page 1 of the CURRENT filters), not the mismatched page.
    expect(await screen.findByText((text) => text.startsWith("2 items"))).toBeInTheDocument();
    const requested = onRequest.mock.calls.at(-1)?.[0] as URL;
    expect(requested.searchParams.get("_cursor")).toBeNull();
    expect(requested.searchParams.get("code~prefix")).toBe("abc");
  });

  it("uses pageUrl as-is when filters is omitted and pageUrl encodes no filters", async () => {
    setupCollectionHandler();

    renderCollectionView({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?_cursor=page2token`,
      // filters omitted entirely — defaults to {}, which matches what this pageUrl encodes (none).
    });

    expect(await screen.findByText((text) => text.startsWith("5 items"))).toBeInTheDocument();
  });
});

describe("EntityItemCollectionView — Columns selector", () => {
  afterEach(() => {
    localStorage.clear();
    useEntityDisplayPreferencesStore.setState({ overrides: {} });
  });

  it("renders a Columns button next to Filters", async () => {
    setupCollectionHandler();
    renderCollectionView({ profile: makeItemProfile() });

    await screen.findByText((text) => text.startsWith("2 items"));

    expect(screen.getByRole("button", { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("hides a column in the table when it's unchecked in the Columns popover", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderCollectionView({ profile: makeItemProfile() });

    await screen.findByText((text) => text.startsWith("2 items"));
    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
  });

  it("does not write the toggle to persisted preferences", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderCollectionView({ profile: makeItemProfile() });

    await screen.findByText((text) => text.startsWith("2 items"));

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(useEntityDisplayPreferencesStore.getState().overrides).toEqual({});
  });

  it("resets the local column selection on remount", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    const { unmount } = renderCollectionView({ profile: makeItemProfile() });

    await screen.findByText((text) => text.startsWith("2 items"));
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));
    expect(screen.queryByRole("columnheader", { name: "Code" })).not.toBeInTheDocument();
    unmount();

    renderCollectionView({ profile: makeItemProfile() });
    await screen.findByText((text) => text.startsWith("2 items"));

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });

  it("keeps an actively-filtered column visible even when unchecked in the picker", async () => {
    setupCollectionHandler();
    const user = userEvent.setup();
    renderCollectionView({ profile: makeItemProfile(), filters: { "code~prefix": "abc" } });

    await screen.findByText((text) => text.startsWith("2 items"));

    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(screen.getByRole("checkbox", { name: /^Code/ }));

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });
});
