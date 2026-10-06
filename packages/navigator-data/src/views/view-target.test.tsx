/**
 * Tests for view-target resolution (contract `view-target.md`, ADR-014).
 *
 * Covers: name target, link target through the response's profile link, link target through the
 * profiles' `describes` links, not-found, not-supported, problem responses, and the shared cache
 * (a name and a link for the same item cause one request).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { createApiClient } from "../api/client";
import { isProblemWithStatus } from "../api/problem-details/guards";
import { BASE, PROFILE_URL, makeQueryClient, makeWrapper, noopSupplier } from "../hooks/test-utils";
import { queryKeys } from "../query-keys";
import { ensureViewTarget } from "./resolve-view-target";
import { useViewTarget } from "./use-view-target";
import {
  type ViewTarget,
  ViewTargetNotFoundError,
  ViewTargetNotSupportedError,
  isViewTargetNotFound,
  isViewTargetNotSupported,
} from "./view-target";

const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const CUSTOMER_COLLECTION_URL = `${BASE}/customers`;
const CUSTOMER_ITEM_URL = `${CUSTOMER_COLLECTION_URL}/cust-001`;
const ORDER_PROFILE_URL = `${BASE}/profile/orders`;
const ORDER_COLLECTION_URL = `${BASE}/orders`;

const curies = [
  { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
];

const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" },
      { href: ORDER_PROFILE_URL, name: "order", title: "Order" },
    ],
    curies,
  },
  _templates: {},
};

function profileBody(selfUrl: string, collectionUrl: string, name: string) {
  return {
    name,
    title: name,
    description: null,
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _links: {
      self: { href: selfUrl },
      describes: [
        { href: collectionUrl, name: "collection" },
        { href: `${collectionUrl}/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _templates: {},
  };
}

function itemBody(withProfileLink: boolean) {
  return {
    id: "cust-001",
    name: "Acme Corp",
    _links: {
      self: { href: CUSTOMER_ITEM_URL },
      ...(withProfileLink ? { profile: { href: CUSTOMER_PROFILE_URL } } : {}),
    },
  };
}

const collectionBody = {
  _embedded: { item: [itemBody(false)] },
  _links: { self: { href: CUSTOMER_COLLECTION_URL } },
  page: { size: 20, total_items_exact: 1 },
};

/** Registers the profile handlers and returns request counters per URL. */
function setupHandlers(options: { profileLink?: boolean } = {}) {
  const counts = { item: 0, collection: 0, root: 0 };
  server.use(
    http.get(PROFILE_URL, () => {
      counts.root++;
      return HttpResponse.json(profileRootBody);
    }),
    http.get(CUSTOMER_PROFILE_URL, () =>
      HttpResponse.json(profileBody(CUSTOMER_PROFILE_URL, CUSTOMER_COLLECTION_URL, "customer")),
    ),
    http.get(ORDER_PROFILE_URL, () =>
      HttpResponse.json(profileBody(ORDER_PROFILE_URL, ORDER_COLLECTION_URL, "order")),
    ),
    http.get(CUSTOMER_ITEM_URL, () => {
      counts.item++;
      return HttpResponse.json(itemBody(options.profileLink ?? true), {
        headers: { ETag: '"v1"' },
      });
    }),
    http.get(CUSTOMER_COLLECTION_URL, () => {
      counts.collection++;
      return HttpResponse.json({
        ...collectionBody,
        _embedded: { item: [itemBody(options.profileLink ?? true)] },
        _links: collectionBody._links,
      });
    }),
  );
  return counts;
}

const apiFetch = createApiClient(noopSupplier);
const byName = (itemId?: string): ViewTarget => ({ kind: "name", entityName: "customer", itemId });
const byUrl = (href: string): ViewTarget => ({ kind: "url", href });

describe("ensureViewTarget", () => {
  it("resolves a name target with an item id to the profile and the item", async () => {
    setupHandlers();
    const resolved = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byName("cust-001"),
    );
    expect(resolved.profileEntity.name).toBe("customer");
    expect(resolved.entityItem?.id).toBe("cust-001");
    expect(resolved.entityItem?.etag).toBe('"v1"');
    expect(resolved.collectionUrl).toBeUndefined();
  });

  it("resolves a name target without an item id to the collection address", async () => {
    const counts = setupHandlers();
    const resolved = await ensureViewTarget(makeQueryClient(), apiFetch, PROFILE_URL, byName());
    expect(resolved.collectionUrl).toBe(CUSTOMER_COLLECTION_URL);
    expect(resolved.entityItem).toBeUndefined();
    expect(counts.item).toBe(0);
  });

  it("follows the response's profile link for a link target", async () => {
    setupHandlers({ profileLink: true });
    const resolved = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_ITEM_URL),
    );
    expect(resolved.profileEntity.name).toBe("customer");
    expect(resolved.entityItem?.id).toBe("cust-001");
  });

  it("falls back to the profile whose describes link covers the resource", async () => {
    setupHandlers({ profileLink: false });
    const resolved = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_ITEM_URL),
    );
    expect(resolved.profileEntity.name).toBe("customer");
    expect(resolved.entityItem?.id).toBe("cust-001");
  });

  it("falls back to describes when the profile link names no known profile", async () => {
    setupHandlers();
    server.use(
      http.get(CUSTOMER_ITEM_URL, () =>
        HttpResponse.json({
          ...itemBody(false),
          _links: {
            self: { href: CUSTOMER_ITEM_URL },
            profile: { href: `${BASE}/profile/unknown` },
          },
        }),
      ),
    );
    const resolved = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_ITEM_URL),
    );
    expect(resolved.profileEntity.name).toBe("customer");
  });

  it("skips a profile that fails to load while looking for the describing one", async () => {
    setupHandlers({ profileLink: false });
    server.use(http.get(ORDER_PROFILE_URL, () => new HttpResponse(null, { status: 500 })));
    const resolved = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_ITEM_URL),
    );
    expect(resolved.profileEntity.name).toBe("customer");
  });

  it("resolves a collection link, with its query, to the collection address", async () => {
    setupHandlers({ profileLink: false });
    const href = `${CUSTOMER_COLLECTION_URL}?name~prefix=A`;
    const resolved = await ensureViewTarget(makeQueryClient(), apiFetch, PROFILE_URL, byUrl(href));
    expect(resolved.profileEntity.name).toBe("customer");
    expect(resolved.collectionUrl).toBe(href);
    expect(resolved.entityItem).toBeUndefined();
  });

  it("rejects with not-found for an unknown entity name", async () => {
    setupHandlers();
    const error = await ensureViewTarget(makeQueryClient(), apiFetch, PROFILE_URL, {
      kind: "name",
      entityName: "nope",
    }).catch((e: unknown) => e);
    expect(isViewTargetNotFound(error)).toBe(true);
    expect(error).toBeInstanceOf(ViewTargetNotFoundError);
    expect((error as Error).message).toContain("nope");
  });

  it("rejects with not-found when no profile describes the link", async () => {
    setupHandlers({ profileLink: false });
    const other = `${BASE}/things/1`;
    server.use(
      http.get(other, () => HttpResponse.json({ id: "1", _links: { self: { href: other } } })),
    );
    const error = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(other),
    ).catch((e: unknown) => e);
    expect(isViewTargetNotFound(error)).toBe(true);
    expect((error as Error).message).toContain(other);
  });

  it("rejects with not-supported for a link that is neither item nor collection", async () => {
    setupHandlers();
    const relation = `${CUSTOMER_ITEM_URL}/orders`;
    server.use(
      http.get(relation, () =>
        HttpResponse.json({
          _links: { self: { href: relation }, profile: { href: CUSTOMER_PROFILE_URL } },
        }),
      ),
    );
    const error = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byUrl(relation),
    ).catch((e: unknown) => e);
    expect(isViewTargetNotSupported(error)).toBe(true);
    expect(error).toBeInstanceOf(ViewTargetNotSupportedError);
    expect((error as Error).message).toContain(relation);
  });

  it("surfaces a problem response so it can be narrowed with the guards", async () => {
    setupHandlers();
    server.use(
      http.get(CUSTOMER_ITEM_URL, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/not-found/entity-item",
            title: "Not found",
            status: 404,
          },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const error = await ensureViewTarget(
      makeQueryClient(),
      apiFetch,
      PROFILE_URL,
      byName("cust-001"),
    ).catch((e: unknown) => e);
    expect(isProblemWithStatus(error, 404)).toBe(true);
    expect(isViewTargetNotFound(error)).toBe(false);
  });

  it("loads an item once for a name target and a link target of the same item", async () => {
    const counts = setupHandlers();
    const queryClient = makeQueryClient();
    await ensureViewTarget(queryClient, apiFetch, PROFILE_URL, byName("cust-001"));
    const viaLink = await ensureViewTarget(
      queryClient,
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_ITEM_URL),
    );
    expect(counts.item).toBe(1);
    expect(viaLink.entityItem?.id).toBe("cust-001");
  });

  it("loads an item once for a link target and then a name target", async () => {
    const counts = setupHandlers();
    const queryClient = makeQueryClient();
    await ensureViewTarget(queryClient, apiFetch, PROFILE_URL, byUrl(CUSTOMER_ITEM_URL));
    await ensureViewTarget(queryClient, apiFetch, PROFILE_URL, byName("cust-001"));
    expect(counts.item).toBe(1);
  });

  it("caches the item under its self link, where useEntityItem reads it", async () => {
    setupHandlers();
    const queryClient = makeQueryClient();
    const { profileEntity } = await ensureViewTarget(
      queryClient,
      apiFetch,
      PROFILE_URL,
      byName("cust-001"),
    );
    expect(
      queryClient.getQueryData(queryKeys.entityItem.byUrl(profileEntity, CUSTOMER_ITEM_URL)),
    ).toBeDefined();
  });

  it("primes the collection cache from a collection link's response", async () => {
    const counts = setupHandlers();
    const queryClient = makeQueryClient();
    const { profileEntity } = await ensureViewTarget(
      queryClient,
      apiFetch,
      PROFILE_URL,
      byUrl(CUSTOMER_COLLECTION_URL),
    );
    expect(
      queryClient.getQueryData(
        queryKeys.entityItemCollection.byUrl(profileEntity, CUSTOMER_COLLECTION_URL),
      ),
    ).toBeDefined();
    expect(counts.collection).toBe(1);
  });
});

describe("useViewTarget", () => {
  it("resolves a name target to the profile and item", async () => {
    setupHandlers();
    const { result } = renderHook(() => useViewTarget(byName("cust-001")), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.entityItem?.id).toBe("cust-001");
    expect(result.current.isError).toBe(false);
  });

  it("resolves a collection target without loading an item", async () => {
    const counts = setupHandlers();
    const { result } = renderHook(() => useViewTarget(byName()), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.collectionUrl).toBe(CUSTOMER_COLLECTION_URL);
    expect(result.current.isPending).toBe(false);
    expect(counts.item).toBe(0);
  });

  it("resolves a link target, giving the same shape as the name target", async () => {
    setupHandlers();
    const { result } = renderHook(() => useViewTarget(byUrl(CUSTOMER_ITEM_URL)), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.profileEntity.name).toBe("customer");
    expect(result.current.data?.entityItem?.id).toBe("cust-001");
  });

  it("makes no further request after the preload filled the cache", async () => {
    const counts = setupHandlers();
    const queryClient = makeQueryClient();
    await ensureViewTarget(queryClient, apiFetch, PROFILE_URL, byName("cust-001"));
    const { result } = renderHook(() => useViewTarget(byName("cust-001")), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(counts.item).toBe(1);
  });

  it("reports not-found for an unknown entity name", async () => {
    setupHandlers();
    const { result } = renderHook(() => useViewTarget({ kind: "name", entityName: "nope" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isViewTargetNotFound(result.current.error)).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("reports an item problem response", async () => {
    setupHandlers();
    server.use(
      http.get(CUSTOMER_ITEM_URL, () =>
        HttpResponse.json(
          { type: "about:blank", title: "Forbidden", status: 403 },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const { result } = renderHook(() => useViewTarget(byName("cust-001")), {
      wrapper: makeWrapper(makeQueryClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 15000 });
    expect(isProblemWithStatus(result.current.error, 403)).toBe(true);
  }, 20000);

  it("refetch retries a failed resolution", async () => {
    setupHandlers();
    const { result } = renderHook(() => useViewTarget({ kind: "name", entityName: "nope" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await result.current.refetch();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
