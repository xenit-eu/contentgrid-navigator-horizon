/**
 * Tests for useEntityItem hook.
 *
 * Covers:
 * - Known-profile mode { profileEntity, entityId }: success, ETag captured, disabled when entityId undefined, error state
 * - Discover-profile mode { url }: success after profile loaded, pending until profile available, ETag in discover mode
 *
 * Note: useEntityItem itself has no hardcoded retry, but profileByLinkQuery (used internally via
 * useProfileEntities) has retry:3. The item fetch itself uses the queryClient default (retry:false
 * in tests via makeQueryClient). Error tests for the item fetch do NOT need fake timers.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { server } from "../../../test-setup";
import ProfileEntity from "../../accessors/entity-profile";
import type { ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL, makeWrapper } from "../test-utils";
import { useEntityItem } from "./use-entity-item";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const CUSTOMER_COLLECTION_URL = `${BASE}/customers`;
const CUSTOMER_ITEM_URL = `${BASE}/customers/cust-001`;

// Minimal profile root
const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [{ href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" }],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

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

const customerItemBody = {
  id: "cust-001",
  name: "Acme Corp",
  _links: { self: { href: CUSTOMER_ITEM_URL } },
};

// Build a ProfileEntity instance for known-profile mode
function makeCustomerProfile(): ProfileEntity {
  const hal = new HalObject(customerProfileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function setupHandlers(itemEtag?: string) {
  const itemHeaders: Record<string, string> = {};
  if (itemEtag) itemHeaders["ETag"] = itemEtag;

  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
    http.get(CUSTOMER_ITEM_URL, () =>
      HttpResponse.json(customerItemBody, { headers: itemHeaders }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Known-profile mode
// ---------------------------------------------------------------------------

describe("useEntityItem — known-profile mode { profileEntity, entityId }", () => {
  it("fetches an entity item when entityId is provided", async () => {
    setupHandlers();
    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ profileEntity, entityId: "cust-001" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe("cust-001");
  });

  it("captures the ETag from the response", async () => {
    setupHandlers('"etag-abc"');
    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ profileEntity, entityId: "cust-001" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.etag).toBe('"etag-abc"');
  });

  it("query is disabled (isPending, no fetch) when entityId is undefined", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
      // item URL must NOT be called — not registered; MSW would error on unhandled request
    );
    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ profileEntity, entityId: undefined }), {
      wrapper,
    });

    // Wait a tick then confirm still no data (query disabled)
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("isError is true when item fetch returns an error", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
      http.get(CUSTOMER_ITEM_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const profileEntity = makeCustomerProfile();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ profileEntity, entityId: "cust-001" }), {
      wrapper,
    });

    // useEntityItem queryFn uses queryClient default retry (false in tests)
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Discover-profile mode
// ---------------------------------------------------------------------------

describe("useEntityItem — discover-profile mode { url }", () => {
  it("discovers the matching profile and fetches the item by URL", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ url: CUSTOMER_ITEM_URL }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data?.id).toBe("cust-001");
  });

  it("query stays pending until matching profile is loaded", async () => {
    // Profile root responds slowly — item should stay pending
    let resolveRoot!: () => void;
    const rootDelay = new Promise<void>((res) => {
      resolveRoot = res;
    });

    server.use(
      http.get(PROFILE_URL, async () => {
        await rootDelay;
        return HttpResponse.json(profileRootBody);
      }),
      http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
      http.get(CUSTOMER_ITEM_URL, () => HttpResponse.json(customerItemBody)),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ url: CUSTOMER_ITEM_URL }), { wrapper });

    // Before root resolves, item should still be pending
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.data).toBeUndefined();

    // Now let root resolve and confirm item loads
    resolveRoot();
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.id).toBe("cust-001");
  });

  it("captures the ETag in discover mode", async () => {
    setupHandlers('"etag-discover"');
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItem({ url: CUSTOMER_ITEM_URL }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data?.etag).toBe('"etag-discover"');
  });
});
