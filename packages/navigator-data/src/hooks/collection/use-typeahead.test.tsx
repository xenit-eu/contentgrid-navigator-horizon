import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createValues } from "@contentgrid/hal-forms/values";
import { server } from "../../../test-setup";
import ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import { queryKeys } from "../../query-keys";
import {
  BASE,
  PROFILE_URL,
  loadDumpProfile,
  makeProfileEntity,
  makeQueryClient,
  makeWrapper,
} from "../test-utils";
import { useTypeahead } from "./use-typeahead";

// ---------------------------------------------------------------------------
// Fixtures — sourced from the real, anonymised backend dump
// (test-fixtures/entity-profiles/entity-profiles-dump.json) via loadDumpProfile(), not
// hand-built JSON. A hand-built profile tends to set `blueprint:search-param: []` with no
// prompt on every attribute — a combination a real profile never produces — which means the
// test only ever reaches the suffix-parsing fallback path, never the `blueprint:search-param`
// path the backend actually exercises. The dump's `customer` entity already has exactly the
// shapes this file needs: a direct prefix-match property ("name~prefix"), a second direct
// exact-match property ("email"), and (via `order`) a real relation-traversal prefix-match
// property ("customer.name~prefix").
// ---------------------------------------------------------------------------

const CUSTOMER_COLLECTION_URL = `${BASE}/customers`;
const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const ORDER_COLLECTION_URL = `${BASE}/orders`;

function customerProfileJson() {
  return loadDumpProfile("customer");
}

function makeCustomerProfileEntity() {
  return makeProfileEntity(customerProfileJson(), "customers", "customer");
}

function makeCustomerProfileEntityWithoutSearchTemplate() {
  const json = customerProfileJson();
  const otherTemplates = { ...(json._templates as Record<string, unknown>) };
  delete otherTemplates.search;
  return makeProfileEntity({ ...json, _templates: otherTemplates }, "customers", "customer");
}

function orderProfileJson() {
  return loadDumpProfile("order");
}

function makeOrderProfileEntity() {
  return makeProfileEntity(orderProfileJson(), "orders", "order");
}

function halCollection(collectionUrl: string, items: Record<string, unknown>[]) {
  return {
    _links: { self: { href: collectionUrl } },
    _embedded: {
      item: items.map((d, i) => ({
        ...d,
        _links: { self: { href: `${collectionUrl}/${i}` } },
      })),
    },
  };
}

function mockCustomerCollection(
  items: Record<string, unknown>[] = [],
  onRequest?: (url: URL) => void,
) {
  server.use(
    http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(halCollection(CUSTOMER_COLLECTION_URL, items));
    }),
  );
}

function mockOrderCollection(
  items: Record<string, unknown>[] = [],
  onRequest?: (url: URL) => void,
) {
  server.use(
    http.get(ORDER_COLLECTION_URL, ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(halCollection(ORDER_COLLECTION_URL, items));
    }),
  );
}

/**
 * `useTypeahead` always calls `useProfileEntities()` (Rules of Hooks — needed to resolve
 * relation targets), which fetches the profile root. Every test needs this mocked even when
 * it never exercises relation mode, or MSW's `onUnhandledRequest: "error"` fails the test.
 */
function mockProfileRoot(entityLinks: { href: string; name: string }[]) {
  server.use(
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          "cg:entity": entityLinks,
          curies: [
            {
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              name: "cg",
              templated: true,
            },
          ],
        },
        _templates: {},
      }),
    ),
  );
}

function makeHook(
  profileEntity: ProfileEntity,
  searchProperty: SearchHalFormTemplateProperty,
  qc = makeQueryClient(),
) {
  return renderHook(() => useTypeahead({ profileEntity, searchProperty }), {
    wrapper: makeWrapper(qc),
  });
}

describe("useTypeahead", () => {
  const profileEntity = makeCustomerProfileEntity();
  const searchProperty = profileEntity.searchTemplate!.getSearchPropertyByName("name~prefix")!;

  beforeEach(() => {
    mockProfileRoot([{ href: CUSTOMER_PROFILE_URL, name: "customer" }]);
  });

  describe("when the profile entity has no search template", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fetch and returns empty results", () => {
      const entityWithoutSearchTemplate = makeCustomerProfileEntityWithoutSearchTemplate();

      const { result } = makeHook(entityWithoutSearchTemplate, searchProperty);
      act(() => result.current.setQuery("Ac"));
      act(() => vi.advanceTimersByTime(1000));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
    });
  });

  describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fire before the debounce delay", () => {
      const { result } = makeHook(profileEntity, searchProperty);

      act(() => result.current.setQuery("Ac"));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);

      act(() => vi.advanceTimersByTime(249));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("minLength guard", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fire for input shorter than minLength", () => {
      const { result } = makeHook(profileEntity, searchProperty);

      act(() => result.current.setQuery("A"));
      act(() => vi.advanceTimersByTime(1000));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
    });
  });

  it("fires only once when search is called rapidly", async () => {
    let requestCount = 0;
    mockCustomerCollection([{ name: "Acme Corp" }], () => requestCount++);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.setQuery("Ac"));
    act(() => result.current.setQuery("Acm"));

    await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });
    expect(requestCount).toBe(1);
  });

  it("returns results after the debounce delay", async () => {
    mockCustomerCollection([{ name: "Acme Corp" }, { name: "Acme Industries" }]);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.setQuery("Acm"));

    await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });
    expect(result.current.results).toContain("Acme Industries");
  });

  it("clears results immediately when query is reset to empty", async () => {
    mockCustomerCollection([{ name: "Acme Corp" }]);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.setQuery("Acm"));
    await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });

    act(() => result.current.setQuery(""));
    expect(result.current.results).toEqual([]);
  });

  it("exposes isError when the fetch fails", async () => {
    server.use(http.get(CUSTOMER_COLLECTION_URL, () => HttpResponse.error()));

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.setQuery("Acm"));

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.results).toEqual([]);
  });

  it("sends the search property name as the URL query parameter", async () => {
    let capturedUrl: URL | undefined;
    mockCustomerCollection([{ name: "Acme Corp" }], (url) => {
      capturedUrl = url;
    });

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.setQuery("Acm"));

    await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });

    expect(capturedUrl?.searchParams.get("name~prefix")).toBe("Acm");
  });

  it("deduplicates identical attribute values from multiple items", async () => {
    mockCustomerCollection([
      { name: "Acme Corp" },
      { name: "Acme Corp" },
      { name: "Acme Industries" },
    ]);

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.setQuery("Acm"));

    await waitFor(() => expect(result.current.results).toHaveLength(2), { timeout: 3000 });
    expect(result.current.results).toContain("Acme Corp");
    expect(result.current.results).toContain("Acme Industries");
  });

  describe("query key isolation", () => {
    /**
     * Regression for a review finding: a typeahead request can encode to the exact same URL
     * as the table's own collection query (e.g. re-typing a value already committed for this
     * field elsewhere in the sidebar). If both cached under `entityItemCollection.byUrl`, they'd
     * collide into ONE cache entry with two different retry/staleTime/gcTime option sets — the
     * last `useQuery` to register would silently win for both. `useTypeahead` must cache under
     * its own `typeaheadSuggestions` root instead, so this can never happen regardless of
     * whether the two URLs coincide.
     */
    it("caches its result under typeaheadSuggestions.byUrl, not entityItemCollection.byUrl", async () => {
      let capturedUrl: URL | undefined;
      mockCustomerCollection([{ name: "Acme Corp" }], (url) => {
        capturedUrl = url;
      });

      const qc = makeQueryClient();
      const { result } = makeHook(profileEntity, searchProperty, qc);
      act(() => result.current.setQuery("Acm"));
      await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });

      const url = capturedUrl!.toString();
      expect(
        qc.getQueryData(queryKeys.typeaheadSuggestions.byUrl(profileEntity, url)),
      ).toBeDefined();
      expect(
        qc.getQueryData(queryKeys.entityItemCollection.byUrl(profileEntity, url)),
      ).toBeUndefined();
    });
  });

  describe("searchValues", () => {
    it("merges searchValues into the outgoing request URL alongside the prefix filter", async () => {
      let capturedUrl: URL | undefined;
      mockCustomerCollection([{ name: "Acme Corp" }], (url) => {
        capturedUrl = url;
      });

      // "email" is customer's other direct search property (exact-match) — a real active
      // filter the user has set on a different field, that should stay on the request.
      const searchValues = createValues(profileEntity.searchTemplate!.template).withValue(
        "email",
        "contact@acme.example",
      );

      const qc = makeQueryClient();
      const { result } = renderHook(
        () => useTypeahead({ profileEntity, searchProperty, searchValues }),
        { wrapper: makeWrapper(qc) },
      );

      act(() => result.current.setQuery("Acm"));
      await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });

      expect(capturedUrl?.searchParams.get("name~prefix")).toBe("Acm");
      expect(capturedUrl?.searchParams.get("email")).toBe("contact@acme.example");
    });
  });

  describe("relation-traversal properties", () => {
    const orderWithCustomer = makeOrderProfileEntity();
    const customerRelationProperty =
      orderWithCustomer.searchTemplate!.getSearchPropertyByName("customer.name~prefix")!;

    beforeEach(() => {
      // Only the customer link needs to be discoverable here — useTypeahead only consults
      // useProfileEntities() to resolve the relation's target profile.
      mockProfileRoot([{ href: CUSTOMER_PROFILE_URL, name: "customer" }]);
      server.use(http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileJson())));
    });

    it("queries the related entity's own collection, not the parent's", async () => {
      let orderRequests = 0;
      let capturedCustomerUrl: URL | undefined;
      mockOrderCollection([], () => orderRequests++);
      mockCustomerCollection([{ name: "Acme Corp" }], (url) => {
        capturedCustomerUrl = url;
      });

      const { result } = renderHook(
        () =>
          useTypeahead({
            profileEntity: orderWithCustomer,
            searchProperty: customerRelationProperty,
          }),
        { wrapper: makeWrapper() },
      );

      act(() => result.current.setQuery("Ac"));
      await waitFor(() => expect(result.current.results).toContain("Acme Corp"), { timeout: 3000 });

      expect(orderRequests).toBe(0);
      // The local (un-prefixed) property name is used against the customer's own template.
      expect(capturedCustomerUrl?.searchParams.get("name~prefix")).toBe("Ac");
      expect(capturedCustomerUrl?.searchParams.has("customer.name~prefix")).toBe(false);
    });
  });
});
