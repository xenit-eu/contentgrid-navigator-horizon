import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider } from "./context";
import { fetchEntityList, useEntityList } from "./use-entity-list";

const BASE = "https://api.example.com";
const PROFILE_URL = `${BASE}/profile`;
const ROOT_URL = `${BASE}/`;
const COLLECTION_URL = `${BASE}/invoices`;
const ENTITY_PROFILE_URL = `${BASE}/profile/invoices`;

/**
 * Search template as exposed by the platform on the entity profile
 * (_templates.search). Target is the collection URL; properties define the
 * contract for what is searchable. `customer` is deliberately NOT a property —
 * unsupported params must be skipped by the encoder.
 */
const SEARCH_TEMPLATE = {
  method: "GET",
  target: COLLECTION_URL,
  properties: [
    { name: "_sort", type: "text" },
    { name: "number~prefix", type: "text" },
    { name: "status", type: "text" },
  ],
};

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

/**
 * Register both root resource and profile handlers.
 * Root resource cg:entity links provide collection hrefs; profile root provides profile hrefs.
 */
function mockProfile() {
  server.use(
    http.get(ROOT_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: ROOT_URL },
          "cg:entity": [{ href: COLLECTION_URL, name: "invoice", title: "Invoice" }],
          curies: [
            {
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              name: "cg",
              templated: true,
            },
          ],
        },
      }),
    ),
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          "cg:entity": [{ href: `${BASE}/profile/invoices`, name: "invoice", title: "Invoice" }],
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

/**
 * Registers the entity profile handler (GET /profile/invoices).
 * Pass a search template to expose _templates.search; omit it to model an
 * entity profile where search is not permitted (no search template).
 */
function mockEntityProfile(searchTemplate?: Record<string, unknown>) {
  server.use(
    http.get(ENTITY_PROFILE_URL, () =>
      HttpResponse.json({
        name: "invoice",
        title: "Invoice",
        _links: { self: { href: ENTITY_PROFILE_URL } },
        _templates: searchTemplate ? { search: searchTemplate } : {},
      }),
    ),
  );
}

describe("useEntityList", () => {
  it("returns items and parses page.total_items_exact into totalItems", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "inv-1",
                number: "INV-001",
                _links: { self: { href: `${COLLECTION_URL}/inv-1` } },
              },
              {
                id: "inv-2",
                number: "INV-002",
                _links: { self: { href: `${COLLECTION_URL}/inv-2` } },
              },
            ],
          },
          page: { size: 20, total_items_exact: 42 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.items).toHaveLength(2);
    // Regression: previously slice.page (always undefined) was accessed instead of slice.data.page
    expect(result.current.data!.totalItems).toBe(42);
    // id comes from the top-level JSON id field, not URL parsing
    expect(result.current.data!.items[0].id).toBe("inv-1");
    expect(result.current.data!.items[1].id).toBe("inv-2");
  });

  it("returns totalItems from total_items_estimate when exact is absent", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 20, total_items_estimate: 100 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.totalItems).toBe(100);
  });

  it("reports hasNext / hasPrevious from HAL pagination links", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: COLLECTION_URL },
            next: { href: `${COLLECTION_URL}?_cursor=abc` },
          },
          _embedded: { item: [] },
          page: { size: 20, total_items_exact: 50 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.hasNext).toBe(true);
    expect(result.current.data!.hasPrevious).toBe(false);
    expect(result.current.data!.nextHref).toBe(`${COLLECTION_URL}?_cursor=abc`);
  });

  it("encodes sort, search and filters through the profile's search template", async () => {
    mockProfile();
    mockEntityProfile(SEARCH_TEMPLATE);
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 5, total_items_exact: 0 },
        });
      }),
    );

    const { result } = renderHook(
      () =>
        useEntityList("invoice", {
          size: 5,
          sort: "number,asc",
          search: "INV",
          searchField: "number~prefix",
          // One truthy filter (set via the template), one empty filter (skipped)
          // and one filter that is not a property of the search template (skipped).
          filters: { status: "draft", customer: "" },
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = new URL(requestedUrl);
    // size is a first-page pagination param, appended outside the search form
    expect(url.searchParams.get("size")).toBe("5");
    expect(url.searchParams.get("_sort")).toBe("number,asc");
    expect(url.searchParams.get("number~prefix")).toBe("INV");
    expect(url.searchParams.get("status")).toBe("draft");
    // Empty filter values are skipped
    expect(url.searchParams.has("customer")).toBe(false);
  });

  it("skips params that are not properties of the search template", async () => {
    mockProfile();
    mockEntityProfile(SEARCH_TEMPLATE);
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 20, total_items_exact: 0 },
        });
      }),
    );

    const { result } = renderHook(
      // "bogus" is not a property of the search template — the template is the
      // contract for what is searchable, so the param must not be sent.
      () => useEntityList("invoice", { filters: { status: "draft", bogus: "x" } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.has("bogus")).toBe(false);
  });

  it("omits all search params when the profile exposes no search template", async () => {
    mockProfile();
    // Entity profile without _templates.search — search is not permitted
    mockEntityProfile();
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 5, total_items_exact: 0 },
        });
      }),
    );

    const { result } = renderHook(
      () => useEntityList("invoice", { size: 5, sort: "number,asc", filters: { status: "x" } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = new URL(requestedUrl);
    // Only the pagination param survives; search affordance is absent
    expect(url.searchParams.get("size")).toBe("5");
    expect(url.searchParams.has("_sort")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("degrades to an unfiltered list when the entity profile request fails", async () => {
    mockProfile();
    server.use(
      http.get(ENTITY_PROFILE_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 20, total_items_exact: 0 },
        });
      }),
    );

    const { result } = renderHook(
      () => useEntityList("invoice", { filters: { status: "draft" } }),
      { wrapper: makeWrapper() },
    );

    // The list still loads (unfiltered) instead of blocking forever
    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = new URL(requestedUrl);
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("keeps legacy manual query construction when fetchEntityList is called without a template", async () => {
    // Direct callers that have not migrated to the search template yet
    // (use-cross-entity-search, use-recent-items, use-recent-activity)
    // omit the searchTemplate argument and keep their existing behavior.
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 5, total_items_exact: 0 },
        });
      }),
    );

    const apiFetch = createApiClient(noopSupplier);
    await fetchEntityList(apiFetch, COLLECTION_URL, {
      size: 5,
      sort: "number,asc",
      search: "INV",
      searchField: "number~prefix",
      filters: { status: "draft", customer: "" },
    });

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("size")).toBe("5");
    expect(url.searchParams.get("_sort")).toBe("number,asc");
    expect(url.searchParams.get("number~prefix")).toBe("INV");
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.has("customer")).toBe(false);
  });

  it("uses the cursor href verbatim when a cursor param is present", async () => {
    mockProfile();
    const CURSOR_URL = `${COLLECTION_URL}?_cursor=xyz`;
    let requestedUrl = "";
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          _links: { self: { href: CURSOR_URL } },
          _embedded: { item: [] },
          page: { size: 20, total_items_exact: 50 },
        });
      }),
    );

    const { result } = renderHook(
      // cursor must win over all other params — it is a full href from a HAL next/prev link
      () => useEntityList("invoice", { cursor: CURSOR_URL, size: 99 }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("_cursor")).toBe("xyz");
    // size must NOT be appended — the cursor href is followed verbatim
    expect(url.searchParams.has("size")).toBe(false);
  });

  it("falls back to URL path parsing for id when the id field is absent", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              // Malformed item: no top-level id field and no _links — exercises both fallbacks
              { number: "INV-OLD" },
              // No id field but with a self link — id parsed from the href
              {
                number: "INV-001",
                _links: { self: { href: `${COLLECTION_URL}/inv-1` } },
              },
            ],
          },
          page: { size: 20, total_items_exact: 2 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.items).toHaveLength(2);
    // No id and no self link → empty id, empty links
    expect(result.current.data!.items[0].id).toBe("");
    expect(result.current.data!.items[0].selfHref).toBe("");
    expect(result.current.data!.items[0].links).toEqual({});
    // No id but self link present → id parsed from the href (documented fallback)
    expect(result.current.data!.items[1].id).toBe("inv-1");
  });

  it("surfaces an error when the collection endpoint returns 500", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
