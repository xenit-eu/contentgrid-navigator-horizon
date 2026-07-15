/**
 * Tests for useEntityItemCollection hook.
 *
 * Covers:
 * - EntityCollectionDefault mode { profileEntity }: fetches empty search collection
 * - EntityCollectionBySearch mode { profileEntity, searchValues }: fetches with values, disabled when undefined
 * - searchParams "cursor": appends the opaque token as `_cursor` onto the resolved search URL
 * - Error state (EntityItemCollection.fetchByUrlQuery has hardcoded retry:3 — fake timers required)
 * - useEntityItemCollectionInfiniteScroll: success, disabled on undefined searchValues, default mode
 * - ensureEntityItemCollection: the non-hook, loader-safe equivalent
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { createValues } from "@contentgrid/hal-forms/values";
import { server } from "../../test-setup";
import ProfileEntity from "../accessors/entity-profile";
import { createApiClient } from "../api/client";
import type { ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper, noopSupplier } from "./test-utils";
import {
  ensureEntityItemCollection,
  useEntityItemCollection,
  useEntityItemCollectionInfiniteScroll,
} from "./use-entity-item-collection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const CUSTOMER_COLLECTION_URL = `${BASE}/customers`;

const customerProfileBody = {
  name: "customer",
  title: "Customer",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: null,
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
        name: "name",
        title: "Name",
        type: "string",
        description: null,
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: CUSTOMER_PROFILE_URL, title: "Customer" },
    describes: [
      { href: CUSTOMER_COLLECTION_URL, name: "collection" },
      { href: `${CUSTOMER_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: CUSTOMER_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: CUSTOMER_COLLECTION_URL,
      properties: [{ name: "name~prefix", prompt: "Name", type: "text" }],
    },
  },
};

const customerCollectionBody = {
  _embedded: {
    item: [
      {
        id: "cust-001",
        name: "Acme Corp",
        _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-001` } },
      },
      {
        id: "cust-002",
        name: "Globex",
        _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-002` } },
      },
    ],
  },
  _links: { self: { href: CUSTOMER_COLLECTION_URL } },
  page: { size: 20, total_items_exact: 2 },
};

function makeCustomerProfile(): ProfileEntity {
  const hal = new HalObject(customerProfileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function setupCollectionHandler() {
  server.use(http.get(CUSTOMER_COLLECTION_URL, () => HttpResponse.json(customerCollectionBody)));
}

// Shared across every test below that just needs "a normal customer profile"
// — only tests exercising a different profile shape (e.g. no search
// template) construct their own local profile instead of using this.
let profileEntity: ProfileEntity;
beforeEach(() => {
  profileEntity = makeCustomerProfile();
});

// ---------------------------------------------------------------------------
// EntityCollectionDefault mode
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — default mode { profileEntity }", () => {
  it("fetches the entity collection using empty search", async () => {
    setupCollectionHandler();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ profileEntity }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
  });

  it("is disabled (isPending) when profile has no search template", async () => {
    // Profile with no search template
    const noSearchBody = {
      ...customerProfileBody,
      _templates: {
        default: { method: "HEAD", target: CUSTOMER_COLLECTION_URL, properties: [] },
      },
    };
    const hal = new HalObject(noSearchBody as unknown as ProfileEntityShape);
    const profile = new ProfileEntity(
      { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" } as unknown as Link,
      hal as HalObject<ProfileEntityShape>,
    );

    // No collection URL registered — if fetch happens, MSW would error
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
      wrapper,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EntityCollectionBySearch mode
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — search mode { profileEntity, searchValues }", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches with explicit searchValues", async () => {
    setupCollectionHandler();
    const searchTemplate = profileEntity.searchTemplate!;
    const searchValues = createValues(searchTemplate.template);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ profileEntity, searchValues }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
  });

  it("query is disabled (isPending) when searchValues is undefined", async () => {
    // Do not register collection handler — should not be called
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollection({ profileEntity, searchValues: undefined }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("isError is true when collection endpoint returns an error (retry:3 — fake timers)", async () => {
    vi.useFakeTimers();

    server.use(
      http.get(CUSTOMER_COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 403, title: "Forbidden" },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const searchTemplate = profileEntity.searchTemplate!;
    const searchValues = createValues(searchTemplate.template);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ profileEntity, searchValues }), {
      wrapper,
    });

    await vi.runAllTimersAsync();

    expect(result.current.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// searchParams "cursor" — opaque token appended to the resolved search URL
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — searchParams cursor", () => {
  it("appends the cursor as _cursor onto the default search URL", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerCollectionBody);
      }),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useEntityItemCollection({
          profileEntity,
          searchParams: new URLSearchParams({ cursor: "abc123" }),
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl?.searchParams.get("_cursor")).toBe("abc123");
  });

  it("appends the cursor onto a search-values URL too", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerCollectionBody);
      }),
    );

    const searchTemplate = profileEntity.searchTemplate!;
    const searchValues = createValues(searchTemplate.template);
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useEntityItemCollection({
          profileEntity,
          searchValues,
          searchParams: new URLSearchParams({ cursor: "xyz789" }),
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl?.searchParams.get("_cursor")).toBe("xyz789");
  });

  // "No cursor given" is already covered by the default-mode describe above
  // (useEntityItemCollection({ profileEntity }) with no searchParams at all).

  // Error/retry behavior is generic to fetchByUrlQuery regardless of how the
  // URL was built — already covered by the "search mode" describe above, so
  // it isn't re-verified per param mode here.
});

// ---------------------------------------------------------------------------
// ensureEntityItemCollection — non-hook, loader-safe equivalent
// ---------------------------------------------------------------------------

describe("ensureEntityItemCollection", () => {
  it("resolves with a cursor", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerCollectionBody);
      }),
    );
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    await ensureEntityItemCollection(
      queryClient,
      apiFetch,
      { profileEntity, searchParams: new URLSearchParams({ cursor: "abc123" }) },
      BASE,
    );

    expect(capturedUrl?.searchParams.get("_cursor")).toBe("abc123");
  });

  it("resolves without a cursor (first page)", async () => {
    let calls = 0;
    server.use(
      http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
        calls += 1;
        expect(new URL(request.url).searchParams.get("_cursor")).toBeNull();
        return HttpResponse.json(customerCollectionBody);
      }),
    );
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    await ensureEntityItemCollection(queryClient, apiFetch, { profileEntity }, BASE);

    expect(calls).toBe(1);
  });

  it("is a no-op when the request is disabled (no search template, no searchValues)", async () => {
    const noSearchBody = {
      ...customerProfileBody,
      _templates: {
        default: { method: "HEAD", target: CUSTOMER_COLLECTION_URL, properties: [] },
      },
    };
    const hal = new HalObject(noSearchBody as unknown as ProfileEntityShape);
    const profileEntity = new ProfileEntity(
      { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" } as unknown as Link,
      hal as HalObject<ProfileEntityShape>,
    );
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    // No collection handler registered — if a fetch were attempted, MSW would error.
    await expect(
      ensureEntityItemCollection(queryClient, apiFetch, { profileEntity }, BASE),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useEntityItemCollectionInfiniteScroll
// ---------------------------------------------------------------------------

describe("useEntityItemCollectionInfiniteScroll", () => {
  it("fetches the first page in infinite scroll mode (search mode)", async () => {
    setupCollectionHandler();
    const searchTemplate = profileEntity.searchTemplate!;
    const searchValues = createValues(searchTemplate.template);

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollectionInfiniteScroll({ profileEntity, searchValues }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });

  it("infinite scroll is disabled (isPending) when searchValues is undefined", async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollectionInfiniteScroll({ profileEntity, searchValues: undefined }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("infinite scroll default mode fetches collection", async () => {
    setupCollectionHandler();

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollectionInfiniteScroll({ profileEntity }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });

  it("infinite scroll starts from a given cursor", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerCollectionBody);
      }),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useEntityItemCollectionInfiniteScroll({
          profileEntity,
          searchParams: new URLSearchParams({ cursor: "abc123" }),
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl?.searchParams.get("_cursor")).toBe("abc123");
    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });
});
