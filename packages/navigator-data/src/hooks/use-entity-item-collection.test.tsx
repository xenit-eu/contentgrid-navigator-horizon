/**
 * Tests for useEntityItemCollection hook.
 *
 * Covers:
 * - EntityCollectionDefault mode { profileEntity }: fetches empty search collection
 * - EntityCollectionBySearch mode { profileEntity, searchValues }: fetches with values, disabled when undefined
 * - EntityCollectionByUrl mode { url, profileEntity }: fetches a specific URL
 * - Error state (EntityItemCollection.fetchByUrlQuery has hardcoded retry:3 — fake timers required)
 * - useEntityItemCollectionInfiniteScroll: success, disabled on undefined searchValues, default mode, URL mode
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { createValues } from "@contentgrid/hal-forms/values";
import { server } from "../../test-setup";
import ProfileEntity from "../accessors/entity-profile";
import type { ProfileEntityShape } from "../shapes";
import { BASE, makeWrapper } from "./test-utils";
import {
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
        name: "name",
        title: "Name",
        type: "string",
        description: "",
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
      properties: [{ name: "name~prefix", type: "text" }],
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

// ---------------------------------------------------------------------------
// EntityCollectionDefault mode
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — default mode { profileEntity }", () => {
  it("fetches the entity collection using empty search", async () => {
    setupCollectionHandler();
    const profileEntity = makeCustomerProfile();
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
    const profileEntity = makeCustomerProfile();
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
    const profileEntity = makeCustomerProfile();

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
    const profileEntity = makeCustomerProfile();
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
// EntityCollectionByUrl mode
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — URL mode { url, profileEntity }", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches from the specified URL", async () => {
    // Use a clean URL without query params to avoid MSW query-param handler issues
    const nextPageUrl = `${CUSTOMER_COLLECTION_URL}/page2`;
    const nextPageBody = {
      _embedded: {
        item: [
          {
            id: "cust-003",
            name: "Corp Three",
            _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-003` } },
          },
        ],
      },
      _links: { self: { href: nextPageUrl } },
      page: { size: 20, total_items_exact: 1 },
    };

    server.use(http.get(nextPageUrl, () => HttpResponse.json(nextPageBody)));

    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollection({ url: nextPageUrl, profileEntity }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].id).toBe("cust-003");
  });

  it("isError is true when URL endpoint returns an error (retry:3 — fake timers)", async () => {
    vi.useFakeTimers();

    const errorUrl = `${CUSTOMER_COLLECTION_URL}/error-page`;
    server.use(
      http.get(errorUrl, () =>
        HttpResponse.json(
          { status: 403, title: "Forbidden" },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ url: errorUrl, profileEntity }), {
      wrapper,
    });

    await vi.runAllTimersAsync();

    expect(result.current.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EntityCollectionByUrl mode — origin guard (security)
// ---------------------------------------------------------------------------

describe("useEntityItemCollection — URL mode origin guard", () => {
  it("discards a cross-origin cursor URL and falls back to the first-page URL", async () => {
    // Only the trusted first-page (default search) collection URL is registered.
    // If the evil-origin URL were fetched, MSW would report an unhandled request
    // and the query would error instead of succeeding.
    setupCollectionHandler();
    const profileEntity = makeCustomerProfile();
    const evilUrl = "https://evil.example/x";

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollection({ url: evilUrl, profileEntity }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
  });

  it("accepts a same-origin cursor URL verbatim", async () => {
    const nextPageUrl = `${CUSTOMER_COLLECTION_URL}/page2`;
    const nextPageBody = {
      _embedded: {
        item: [
          {
            id: "cust-003",
            name: "Corp Three",
            _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-003` } },
          },
        ],
      },
      _links: { self: { href: nextPageUrl } },
      page: { size: 20, total_items_exact: 1 },
    };
    server.use(http.get(nextPageUrl, () => HttpResponse.json(nextPageBody)));

    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollection({ url: nextPageUrl, profileEntity }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].id).toBe("cust-003");
  });

  it("accepts a relative same-origin cursor, resolving it against the API base", async () => {
    // Regression coverage: the trust anchor is the absolute API base
    // (profileUrl), not profileEntity.collectionUrl. A relative cursor must
    // resolve against that base and be trusted — anchoring on a relative
    // collectionUrl would make `new URL(...)` throw and silently disable
    // cursor pagination for every relative-collection-URL deployment.
    const resolvedUrl = `${BASE}/relative-path`;
    const relativePageBody = {
      _embedded: {
        item: [
          {
            id: "cust-004",
            name: "Relative Corp",
            _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-004` } },
          },
        ],
      },
      _links: { self: { href: resolvedUrl } },
      page: { size: 20, total_items_exact: 1 },
    };
    server.use(http.get(resolvedUrl, () => HttpResponse.json(relativePageBody)));

    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollection({ url: "/relative-path", profileEntity }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].id).toBe("cust-004");
  });

  it("discards an unparsable cursor URL and falls back to the first-page URL", async () => {
    setupCollectionHandler();
    const profileEntity = makeCustomerProfile();

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollection({ url: "http://[::1", profileEntity }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// useEntityItemCollectionInfiniteScroll
// ---------------------------------------------------------------------------

describe("useEntityItemCollectionInfiniteScroll", () => {
  it("fetches the first page in infinite scroll mode (search mode)", async () => {
    setupCollectionHandler();
    const profileEntity = makeCustomerProfile();
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
    const profileEntity = makeCustomerProfile();

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
    const profileEntity = makeCustomerProfile();

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemCollectionInfiniteScroll({ profileEntity }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });

  it("infinite scroll by URL fetches from specified URL", async () => {
    const specificUrl = `${CUSTOMER_COLLECTION_URL}/specific-page`;
    server.use(
      http.get(specificUrl, () =>
        HttpResponse.json({
          ...customerCollectionBody,
          _links: { self: { href: specificUrl } },
        }),
      ),
    );
    const profileEntity = makeCustomerProfile();

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemCollectionInfiniteScroll({ url: specificUrl, profileEntity }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });
});
