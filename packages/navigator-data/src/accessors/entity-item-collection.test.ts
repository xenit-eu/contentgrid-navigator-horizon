import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, HalSlice, type Link } from "@contentgrid/hal";
import type { HalObjectShape, HalSliceShape } from "@contentgrid/hal/shape";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { queryKeys } from "../query-keys";
import type { ProfileEntityShape } from "../shapes";
import { EntityItem } from "./entity-item";
import { EntityItemCollection } from "./entity-item-collection";
import ProfileEntity from "./entity-profile";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeProfileEntity(name = "invoice"): ProfileEntity {
  const json: Record<string, unknown> = {
    name,
    description: "",
    _links: {
      self: { href: `/profile/${name}s` },
      describes: [
        { href: `/${name}s`, name: "collection" },
        { href: `/${name}s/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject<ProfileEntityShape>(
    json as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: `/profile/${name}s`, name } as unknown as Link, hal);
}

function makeHalSlice(overrides: {
  items?: Record<string, unknown>[];
  nextHref?: string;
  prevHref?: string;
  firstHref?: string;
  pageData?: { total_items_exact?: number; total_items_estimate?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): HalSlice<any> {
  const { items = [], nextHref, prevHref, firstHref, pageData } = overrides;

  const links: Record<string, unknown> = {
    self: { href: "/invoices" },
  };
  if (nextHref) links.next = { href: nextHref };
  if (prevHref) links.prev = { href: prevHref };
  if (firstHref) links.first = { href: firstHref };

  const shape: HalSliceShape<Record<string, unknown>> & { page?: Record<string, unknown> } = {
    _links: links as Record<string, { href: string }>,
    _embedded: {
      item: items.map((item) => ({
        ...item,
        _links: { self: { href: `/invoices/${(item as { id: string }).id}` } },
      })) as HalObjectShape<Record<string, unknown>>[],
    },
  };

  if (pageData) {
    (shape as Record<string, unknown>).page = pageData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new HalSlice<any>(shape as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EntityItemCollection — items", () => {
  it("returns empty items when collection is empty", () => {
    const collection = new EntityItemCollection(makeHalSlice({ items: [] }), makeProfileEntity());
    expect(collection.items).toHaveLength(0);
  });

  it("wraps each item as an EntityItem", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({
        items: [
          { id: "inv-001", number: "INV-001" },
          { id: "inv-002", number: "INV-002" },
        ],
      }),
      makeProfileEntity(),
    );
    expect(collection.items).toHaveLength(2);
    expect(collection.items[0]).toBeInstanceOf(EntityItem);
    expect(collection.items[0].id).toBe("inv-001");
    expect(collection.items[1].id).toBe("inv-002");
  });
});

describe("EntityItemCollection — totalItems", () => {
  it("returns exact count when total_items_exact is present", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ pageData: { total_items_exact: 42 } }),
      makeProfileEntity(),
    );
    expect(collection.totalItems).toEqual({ count: 42, isEstimated: false });
  });

  it("returns estimated count when only total_items_estimate is present", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ pageData: { total_items_estimate: 100 } }),
      makeProfileEntity(),
    );
    expect(collection.totalItems).toEqual({ count: 100, isEstimated: true });
  });

  it("returns undefined when no page data", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.totalItems).toBeUndefined();
  });

  it("prefers exact count over estimate when both are present", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ pageData: { total_items_exact: 10, total_items_estimate: 15 } }),
      makeProfileEntity(),
    );
    expect(collection.totalItems).toEqual({ count: 10, isEstimated: false });
  });
});

describe("EntityItemCollection — pagination", () => {
  it("pageSize returns the count of items in the page", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ items: [{ id: "inv-001" }, { id: "inv-002" }] }),
      makeProfileEntity(),
    );
    expect(collection.pageSize).toBe(2);
  });

  it("hasNext returns true when next link is present", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ nextHref: "/invoices?cursor=abc" }),
      makeProfileEntity(),
    );
    expect(collection.hasNext).toBe(true);
  });

  it("hasNext returns false when no next link", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.hasNext).toBe(false);
  });

  it("hasPrevious returns true when prev link is present", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ prevHref: "/invoices?cursor=xyz" }),
      makeProfileEntity(),
    );
    expect(collection.hasPrevious).toBe(true);
  });

  it("hasPrevious returns false when no prev link", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.hasPrevious).toBe(false);
  });

  it("nextHref returns the next link href", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ nextHref: "/invoices?cursor=abc" }),
      makeProfileEntity(),
    );
    expect(collection.nextHref).toBe("/invoices?cursor=abc");
  });

  it("nextHref returns undefined when no next link", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.nextHref).toBeUndefined();
  });

  it("prevHref returns the previous link href", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ prevHref: "/invoices?cursor=xyz" }),
      makeProfileEntity(),
    );
    expect(collection.prevHref).toBe("/invoices?cursor=xyz");
  });

  it("prevHref returns undefined when no prev link", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.prevHref).toBeUndefined();
  });

  it("firstHref returns the first page link href", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ firstHref: "/invoices" }),
      makeProfileEntity(),
    );
    expect(collection.firstHref).toBe("/invoices");
  });

  it("firstHref returns undefined when no first link", () => {
    const collection = new EntityItemCollection(makeHalSlice({}), makeProfileEntity());
    expect(collection.firstHref).toBeUndefined();
  });
});

describe("EntityItemCollection — isEmpty", () => {
  it("returns true when there are no items and total count is 0", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ items: [], pageData: { total_items_exact: 0 } }),
      makeProfileEntity(),
    );
    expect(collection.isEmpty).toBe(true);
  });

  it("returns true when there are no items and no total count", () => {
    const collection = new EntityItemCollection(makeHalSlice({ items: [] }), makeProfileEntity());
    expect(collection.isEmpty).toBe(true);
  });

  it("returns false when there are items", () => {
    const collection = new EntityItemCollection(
      makeHalSlice({ items: [{ id: "inv-001" }], pageData: { total_items_exact: 5 } }),
      makeProfileEntity(),
    );
    expect(collection.isEmpty).toBe(false);
  });

  it("returns false when total count is non-zero even if current page is empty", () => {
    // Edge case: total_items_exact > 0 but no items on this page
    const collection = new EntityItemCollection(
      makeHalSlice({ items: [], pageData: { total_items_exact: 5 } }),
      makeProfileEntity(),
    );
    expect(collection.isEmpty).toBe(false);
  });
});

describe("EntityItemCollection — static fetchByUrlQuery", () => {
  const COLLECTION_URL = "https://api.example.com/invoices";

  it("returns query options with the correct queryKey", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.fetchByUrlQuery(apiFetch, COLLECTION_URL, profile);
    expect(opts.queryKey).toEqual(queryKeys.entityItemCollection.byUrl(profile, COLLECTION_URL));
  });

  it("applies override options", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.fetchByUrlQuery(apiFetch, COLLECTION_URL, profile, {
      staleTime: 999,
    });
    expect(opts.staleTime).toBe(999);
  });

  it("queryFn fetches and returns an EntityItemCollection", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [{ id: "inv-001", _links: { self: { href: `${COLLECTION_URL}/inv-001` } } }],
          },
          page: { total_items_exact: 1 },
        }),
      ),
    );
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.fetchByUrlQuery(apiFetch, COLLECTION_URL, profile);
    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeInstanceOf(EntityItemCollection);
    expect(result.items).toHaveLength(1);
  });
});

describe("EntityItemCollection — static infiniteQuery", () => {
  const COLLECTION_URL = "https://api.example.com/invoices";

  it("returns infinite query options with the correct queryKey", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    expect(opts.queryKey).toEqual(
      queryKeys.entityItemCollection.infiniteByUrl(profile, COLLECTION_URL),
    );
  });

  it("getNextPageParam returns nextHref from the last page", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    const pageWithNext = new EntityItemCollection(
      makeHalSlice({ nextHref: "/invoices?cursor=abc" }),
      profile,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(opts.getNextPageParam(pageWithNext, [] as any, "" as any, [] as any)).toBe(
      "/invoices?cursor=abc",
    );
  });

  it("getNextPageParam returns undefined when no next page", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    const pageWithoutNext = new EntityItemCollection(makeHalSlice({}), profile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(opts.getNextPageParam(pageWithoutNext, [] as any, "" as any, [] as any)).toBeUndefined();
  });

  it("getPreviousPageParam returns prevHref from the first page", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    const pageWithPrev = new EntityItemCollection(
      makeHalSlice({ prevHref: "/invoices?cursor=xyz" }),
      profile,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(opts.getPreviousPageParam!(pageWithPrev, [] as any, "" as any, [] as any)).toBe(
      "/invoices?cursor=xyz",
    );
  });

  it("queryFn fetches using initialUrl when pageParam is undefined", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
        }),
      ),
    );
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (opts as any).queryFn({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      pageParam: undefined,
      direction: "forward",
      meta: undefined,
    });
    expect(result).toBeInstanceOf(EntityItemCollection);
  });

  it("queryFn uses pageParam url when provided", async () => {
    const PAGE2_URL = "https://api.example.com/invoices?cursor=page2";
    server.use(
      http.get(PAGE2_URL, () =>
        HttpResponse.json({
          _links: { self: { href: PAGE2_URL } },
          _embedded: { item: [] },
        }),
      ),
    );
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItemCollection.infiniteQuery(apiFetch, COLLECTION_URL, profile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (opts as any).queryFn({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      pageParam: PAGE2_URL,
      direction: "forward",
      meta: undefined,
    });
    expect(result).toBeInstanceOf(EntityItemCollection);
  });
});
