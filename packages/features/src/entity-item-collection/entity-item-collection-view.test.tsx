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
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../test-setup";
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
      properties: [{ name: "code~prefix", type: "text" }],
    },
  },
};

function makeItemProfile(): ProfileEntity {
  return makeProfileEntity(itemProfileJson, PROFILE_URL, "item");
}

// A distinguishable ITEM COUNT (not just page metadata — `EntityItemCollection.pageSize` reads
// `halSlice.items.length`), so the rendered "N items on this page" string (from
// EntityItemCollectionTable's pagination footer) tells us unambiguously which response actually
// got used. `_links.next` is required for that footer to render at all (`collection.hasNext`).
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

    expect(await screen.findByText("2 items on this page")).toBeInTheDocument();
  });

  it("uses pageUrl directly when it encodes the SAME filters — preserves pagination", async () => {
    const onRequest = vi.fn();
    setupCollectionHandler(onRequest);

    renderCollectionView({
      profile: makeItemProfile(),
      pageUrl: `${COLLECTION_URL}?code~prefix=abc&_cursor=page2token`,
      filters: { "code~prefix": "abc" },
    });

    expect(await screen.findByText("5 items on this page")).toBeInTheDocument();
    expect(onRequest).toHaveBeenCalled();
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
    expect(await screen.findByText("2 items on this page")).toBeInTheDocument();
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

    expect(await screen.findByText("5 items on this page")).toBeInTheDocument();
  });
});
