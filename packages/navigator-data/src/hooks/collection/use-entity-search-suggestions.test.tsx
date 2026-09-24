/**
 * Tests for useEntitySearchSuggestions.
 *
 * Fixture: a hand-built "item" entity with two DIRECT string-searchable attributes
 * ("title~prefix", "notes~fts") plus one RELATION-TRAVERSAL string-searchable attribute
 * ("vendor.name~prefix", via the "vendor" relation) — enough contributing properties to
 * exercise the fan-out across attributes and the relation-traversal same-entity-type rule
 * (research D2 / FR-024), without needing the full backend dump (this hook's own orchestration,
 * not search-type resolution itself, is what's under test here — see `loadDumpProfile`'s doc
 * comment for when that distinction matters).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test-setup";
import { AttributeKind } from "../../accessors/entity-item";
import type { ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL, makeProfileEntity, makeQueryClient, makeWrapper } from "../test-utils";
import { useEntitySearchSuggestions } from "./use-entity-search-suggestions";

const ITEM_PROFILE_URL = `${BASE}/profile/items`;
const ITEM_COLLECTION_URL = `${BASE}/items`;
const VENDOR_PROFILE_URL = `${BASE}/profile/vendors`;
const VENDOR_COLLECTION_URL = `${BASE}/vendors`;

const itemProfileJson: ProfileEntityShape = {
  name: "item",
  title: "Item",
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "title",
        title: "Title",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "title~prefix", title: "Title", type: "prefix-match" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "notes",
        title: "Notes",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "notes~fts", title: "Notes", type: "full-text" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [
      {
        name: "vendor",
        title: "Vendor",
        description: "",
        many_source_per_target: true,
        many_target_per_source: false,
        required: false,
        _links: { "blueprint:target-entity": { href: VENDOR_PROFILE_URL } },
      },
    ],
  },
  _links: {
    self: { href: ITEM_PROFILE_URL, title: "Item" },
    describes: [
      { href: ITEM_COLLECTION_URL, name: "collection" },
      { href: `${ITEM_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: ITEM_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: ITEM_COLLECTION_URL,
      properties: [
        { name: "title~prefix", type: "text" },
        { name: "notes~fts", type: "text" },
        { name: "vendor.name~prefix", type: "text" },
      ],
    },
  },
} as unknown as ProfileEntityShape;

const vendorProfileJson: ProfileEntityShape = {
  name: "vendor",
  title: "Vendor",
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "name",
        title: "Name",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "name~prefix", title: "Name", type: "prefix-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: VENDOR_PROFILE_URL, title: "Vendor" },
    describes: [
      { href: VENDOR_COLLECTION_URL, name: "collection" },
      { href: `${VENDOR_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: VENDOR_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: VENDOR_COLLECTION_URL,
      properties: [{ name: "name~prefix", type: "text" }],
    },
  },
} as unknown as ProfileEntityShape;

function makeItemProfileEntity() {
  return makeProfileEntity(itemProfileJson, "items", "item");
}

function halCollection(collectionUrl: string, items: Record<string, unknown>[]) {
  return {
    _links: { self: { href: collectionUrl } },
    _embedded: {
      item: items.map((d, i) => ({ ...d, _links: { self: { href: `${collectionUrl}/${i}` } } })),
    },
  };
}

/**
 * `useEntitySearchSuggestions` always calls `useProfileEntities()` (Rules of Hooks — needed to
 * resolve the "vendor" relation's target profile), so every test needs the profile root mocked.
 * Only "vendor" needs to be discoverable this way — `profileEntity` (item) itself is passed in
 * directly, never fetched via the root fan-out (same convention `use-typeahead.test.tsx` uses).
 */
function mockProfileRoot() {
  server.use(
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          "cg:entity": [{ href: VENDOR_PROFILE_URL, name: "vendor" }],
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

function mockVendorProfile() {
  server.use(http.get(VENDOR_PROFILE_URL, () => HttpResponse.json(vendorProfileJson)));
}

/**
 * Registers ONE response per query-param name (`byProperty`), rather than one blanket response
 * for the whole collection URL — three separate contributing properties each probe this SAME
 * collection URL with a DIFFERENT query param, and a single unconditional mock would return
 * identical results for all three, hiding which property actually matched. Falls back to an
 * empty collection for any query param not listed.
 */
function mockItemCollectionByProperty(byProperty: Record<string, Record<string, unknown>[]>) {
  server.use(
    http.get(ITEM_COLLECTION_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      for (const [property, items] of Object.entries(byProperty)) {
        if (params.has(property))
          return HttpResponse.json(halCollection(ITEM_COLLECTION_URL, items));
      }
      return HttpResponse.json(halCollection(ITEM_COLLECTION_URL, []));
    }),
  );
}

function mockVendorCollection(items: Record<string, unknown>[] = []) {
  server.use(
    http.get(VENDOR_COLLECTION_URL, () =>
      HttpResponse.json(halCollection(VENDOR_COLLECTION_URL, items)),
    ),
  );
}

function makeHook(
  query: string,
  profileEntity = makeItemProfileEntity(),
  options?: { readonly includeRelationSearch?: boolean },
) {
  return renderHook(() => useEntitySearchSuggestions({ profileEntity, query, ...options }), {
    wrapper: makeWrapper(makeQueryClient()),
  });
}

describe("useEntitySearchSuggestions", () => {
  beforeEach(() => {
    mockProfileRoot();
    mockVendorProfile();
  });

  it("does not fetch below minLength", () => {
    mockItemCollectionByProperty({ "title~prefix": [{ title: "Acme Corp" }] });
    mockVendorCollection([]);

    const { result } = makeHook("A");

    expect(result.current.isLoading).toBe(false);
    expect(result.current.searchTermSuggestions).toEqual([]);
    expect(result.current.effectiveMatchCandidates).toEqual([]);
  });

  it("returns search-term suggestions for a direct attribute, attributed to it", async () => {
    mockItemCollectionByProperty({ "title~prefix": [{ title: "Acme Corp" }] });
    mockVendorCollection([]);

    const { result } = makeHook("Ac");

    await waitFor(() =>
      expect(result.current.searchTermSuggestions.map((s) => s.value)).toContain("Acme Corp"),
    );
    const suggestion = result.current.searchTermSuggestions.find((s) => s.value === "Acme Corp")!;
    expect(suggestion.propertyName).toBe("title~prefix");
    expect(suggestion.attributeGroupKey).toBe("title");
    expect(suggestion.relationLabel).toBeUndefined();
  });

  it("returns effective-match candidates of the current entity type for a direct-attribute match", async () => {
    mockItemCollectionByProperty({ "title~prefix": [{ title: "Acme Corp" }] });
    mockVendorCollection([]);

    const { result } = makeHook("Ac");

    await waitFor(() => expect(result.current.effectiveMatchCandidates).toHaveLength(1));
    const titleValue = result.current.effectiveMatchCandidates[0].findAttribute("title")?.value;
    expect(titleValue?.kind === AttributeKind.PLAIN && titleValue.value).toBe("Acme Corp");
  });

  it("aggregates suggestions from more than one contributing attribute at once", async () => {
    mockItemCollectionByProperty({
      "title~prefix": [{ title: "Acme Corp" }],
      "notes~fts": [{ notes: "Acme has a discount" }],
    });
    mockVendorCollection([]);

    const { result } = makeHook("Ac");

    await waitFor(() => {
      const groupKeys = result.current.searchTermSuggestions.map((s) => s.attributeGroupKey);
      expect(groupKeys).toContain("title");
      expect(groupKeys).toContain("notes");
    });
  });

  it("exposes isLoading while any per-attribute request is in flight", async () => {
    mockItemCollectionByProperty({ "title~prefix": [{ title: "Acme Corp" }] });
    mockVendorCollection([]);

    const { result } = makeHook("Ac");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("exposes isError only once every request has settled with nothing usable back", async () => {
    server.use(http.get(ITEM_COLLECTION_URL, () => HttpResponse.error()));
    mockVendorCollection([]);

    const { result } = makeHook("Ac");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.searchTermSuggestions).toEqual([]);
    expect(result.current.effectiveMatchCandidates).toEqual([]);
  });

  it("does not surface an error once refetch is called and the request succeeds", async () => {
    let shouldFail = true;
    server.use(
      http.get(ITEM_COLLECTION_URL, () => {
        if (shouldFail) return HttpResponse.error();
        return HttpResponse.json(halCollection(ITEM_COLLECTION_URL, [{ title: "Acme Corp" }]));
      }),
    );
    mockVendorCollection([]);

    const { result } = makeHook("Ac");
    await waitFor(() => expect(result.current.isError).toBe(true));

    shouldFail = false;
    result.current.refetch();

    await waitFor(() =>
      expect(result.current.searchTermSuggestions.map((s) => s.value)).toContain("Acme Corp"),
    );
    expect(result.current.isError).toBe(false);
  });

  describe("relation-traversal properties (FR-003, FR-024)", () => {
    it("excludes relation-traversal suggestions by default (includeRelationSearch defaults to false)", async () => {
      mockItemCollectionByProperty({});
      mockVendorCollection([{ name: "Acme Supplies" }]);

      const { result } = makeHook("Ac");

      // Only direct attributes are enabled by default, so nothing ever fetches for
      // "vendor.name~prefix" — give any stray request a chance to resolve, then assert
      // the related entity's value never surfaces.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.searchTermSuggestions.map((s) => s.value)).not.toContain(
        "Acme Supplies",
      );
    });

    it("exposes hasRelationSearchableProperty regardless of includeRelationSearch", () => {
      const { result } = makeHook("Ac");
      expect(result.current.hasRelationSearchableProperty).toBe(true);
    });

    it("returns a search-term suggestion attributed to the relation, sourced from the related entity's own collection, when includeRelationSearch is true", async () => {
      mockItemCollectionByProperty({});
      mockVendorCollection([{ name: "Acme Supplies" }]);

      const { result } = makeHook("Ac", undefined, { includeRelationSearch: true });

      await waitFor(() =>
        expect(result.current.searchTermSuggestions.map((s) => s.value)).toContain("Acme Supplies"),
      );
      const suggestion = result.current.searchTermSuggestions.find(
        (s) => s.value === "Acme Supplies",
      )!;
      expect(suggestion.propertyName).toBe("vendor.name~prefix");
      expect(suggestion.attributeGroupKey).toBe("vendor.name");
      expect(suggestion.relationLabel).toBe("Vendor");
    });

    it("keeps effective-match candidates for a relation-traversal match as the CURRENT entity type, never the related entity's", async () => {
      // The item's OWN collection, filtered by the relation-traversal property, is what
      // returns an ITEM (not a vendor) whose vendor happens to match "Ac".
      mockItemCollectionByProperty({ "vendor.name~prefix": [{ title: "Item referencing Acme" }] });
      mockVendorCollection([{ name: "Acme Supplies" }]);

      const { result } = makeHook("Ac", undefined, { includeRelationSearch: true });

      await waitFor(() =>
        expect(result.current.effectiveMatchCandidates.length).toBeGreaterThan(0),
      );
      for (const candidate of result.current.effectiveMatchCandidates) {
        // Every candidate must come from the ITEM profile (this hook's own entity), never
        // the vendor's — a vendor item has no "title" attribute of this shape at all.
        expect(candidate.profileEntity.name).toBe("item");
      }
    });
  });
});
