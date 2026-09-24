import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import type { RecordTableSortOption } from "@contentgrid/ui";
import { server } from "../../../test-setup";
import { selectEffectiveMatches } from "./effective-match-selection";

// Real EntityItem instances only, fetched through the sanctioned useEntityItemCollection +
// MSW route — packages/features must never import @contentgrid/hal directly to hand-construct
// one (Constitution III), even in a test.

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/items`;
const COLLECTION_URL = `${API_URL}/items`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

const itemProfileJson = {
  name: "item",
  title: "Item",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: COLLECTION_URL, name: "collection" },
      { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        name: "blueprint",
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        templated: true,
      },
    ],
  },
  _embedded: {
    "blueprint:attribute": [
      {
        name: "title",
        title: "Title",
        type: "string",
        readOnly: false,
        _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
        _links: {},
      },
      {
        name: "amount",
        title: "Amount",
        type: "long",
        readOnly: false,
        _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "title", type: "text" },
        { name: "amount", type: "number" },
      ],
    },
  },
};

function makeItemProfile(): ProfileEntity {
  return makeProfileEntity(itemProfileJson, PROFILE_URL, "item");
}

function itemBody(id: string, title: string, amount?: number) {
  return {
    id,
    title,
    ...(amount === undefined ? {} : { amount }),
    _links: { self: { href: `${COLLECTION_URL}/${id}` } },
  };
}

function setupHandler(items: ReturnType<typeof itemBody>[]) {
  server.use(
    http.get(COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: { item: items },
        _links: { self: { href: COLLECTION_URL } },
      }),
    ),
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  return function Wrapper({ children }: { children: ReactNode }) {
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
  };
}

async function fetchItems(items: ReturnType<typeof itemBody>[]): Promise<readonly EntityItem[]> {
  setupHandler(items);
  const profile = makeItemProfile();
  const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data!.items;
}

function titleSort(direction: "asc" | "desc"): RecordTableSortOption {
  return { value: `title,${direction}`, property: "title", prompt: "Title", direction };
}

const amountSortAsc: RecordTableSortOption = {
  value: "amount,asc",
  property: "amount",
  prompt: "Amount",
  direction: "asc",
};

afterEach(() => {
  server.resetHandlers();
});

describe("selectEffectiveMatches", () => {
  it("returns an empty list for no candidates", () => {
    expect(selectEffectiveMatches([], undefined)).toEqual([]);
  });

  it("caps the result at the given cap", async () => {
    const items = await fetchItems(
      Array.from({ length: 8 }, (_, i) => itemBody(String(i), `Item ${i}`)),
    );
    expect(selectEffectiveMatches(items, undefined, 5)).toHaveLength(5);
  });

  it("defaults to a cap of 5", async () => {
    const items = await fetchItems(
      Array.from({ length: 8 }, (_, i) => itemBody(String(i), `Item ${i}`)),
    );
    expect(selectEffectiveMatches(items, undefined)).toHaveLength(5);
  });

  it("dedupes the same record id contributed by more than one attribute", async () => {
    const items = await fetchItems([itemBody("1", "Acme"), itemBody("2", "Other")]);
    const [a, c] = items;

    // Same record referenced twice, e.g. once via each of two different matching attributes.
    const result = selectEffectiveMatches([a, a, c], undefined, 5);
    expect(result.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("preserves arrival order when no sort option is given", async () => {
    const items = await fetchItems([itemBody("2", "Beta"), itemBody("1", "Alpha")]);
    const result = selectEffectiveMatches(items, undefined, 5);
    expect(result.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("orders ascending by the current sort option's property", async () => {
    const items = await fetchItems([
      itemBody("1", "Beta"),
      itemBody("2", "Alpha"),
      itemBody("3", "Charlie"),
    ]);
    const result = selectEffectiveMatches(items, titleSort("asc"), 5);
    expect(result.map((i) => i.id)).toEqual(["2", "1", "3"]);
  });

  it("orders descending when the current sort option's direction is desc", async () => {
    const items = await fetchItems([
      itemBody("1", "Beta"),
      itemBody("2", "Alpha"),
      itemBody("3", "Charlie"),
    ]);
    const result = selectEffectiveMatches(items, titleSort("desc"), 5);
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts a record missing the sort attribute's value to the end regardless of direction", async () => {
    const items = await fetchItems([itemBody("1", "Beta"), itemBody("3", "Gamma", 5)]);
    const result = selectEffectiveMatches(items, amountSortAsc, 5);
    expect(result.map((i) => i.id)).toEqual(["3", "1"]);
  });
});
