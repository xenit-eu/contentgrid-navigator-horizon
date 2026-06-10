import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { INVOICE_ENTITY, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useCrossEntitySearch } from "./use-cross-entity-search";

const SCHEMA_URL = INVOICE_ENTITY.href;
const COLLECTION_URL = INVOICE_ENTITY.collectionHref;

const schemaFixture = {
  name: "invoice",
  _links: {
    self: { href: SCHEMA_URL },
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: {
    "blueprint:attribute": [
      {
        name: "number",
        title: "Number",
        type: "string",
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
  _templates: {
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [{ name: "number~prefix", prompt: "Number", type: "text" }],
    },
  },
};

describe("useCrossEntitySearch", () => {
  it("returns empty results when query is shorter than 2 chars", () => {
    const { result } = renderHook(() => useCrossEntitySearch("I"), { wrapper: makeWrapper() });
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.totalResults).toBe(0);
  });

  it("returns empty results for empty query", () => {
    const { result } = renderHook(() => useCrossEntitySearch(""), { wrapper: makeWrapper() });
    expect(result.current.results).toEqual([]);
  });

  it("returns grouped results with displayFields when query is >= 2 chars", async () => {
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaFixture)),
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
          page: { size: 5, total_items_exact: 2 },
        }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCrossEntitySearch("INV", { size: 5 }), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    expect(result.current.results[0].entityName).toBe("invoice");
    expect(result.current.results[0].items).toHaveLength(2);
    expect(result.current.results[0].totalItems).toBe(2);
    expect(result.current.totalResults).toBe(2);

    // displayFields should include the "number" text attribute
    const firstItem = result.current.results[0].items[0];
    expect(firstItem.displayFields.some((f) => f.label === "Number")).toBe(true);
  });

  it("returns empty results when the search endpoint returns no items", async () => {
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaFixture)),
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 5, total_items_exact: 0 },
        }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCrossEntitySearch("XY"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toHaveLength(0);
    expect(result.current.totalResults).toBe(0);
  });

  it("returns empty results when schema endpoint errors (500)", async () => {
    server.use(
      http.get(SCHEMA_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCrossEntitySearch("INV"), {
      wrapper: makeWrapper(qc),
    });

    // Schema fetch fails, so no search queries fire; isSearching eventually becomes false
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toHaveLength(0);
  });

  it("returns empty results when the entity has no searchable schema properties", async () => {
    const emptySchemaFixture = {
      ...schemaFixture,
      _templates: {
        search: {
          method: "GET",
          target: COLLECTION_URL,
          properties: [],
        },
      },
    };
    server.use(http.get(SCHEMA_URL, () => HttpResponse.json(emptySchemaFixture)));

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCrossEntitySearch("INV"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toHaveLength(0);
  });
});
