import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createValues } from "@contentgrid/hal-forms/values";
import { server } from "../../../test-setup";
import ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import { BASE, makeProfileEntity, makeQueryClient, makeWrapper } from "../test-utils";
import { useTypeahead } from "./use-typeahead";

const COLLECTION_URL = `${BASE}/invoices`;

function makeAttribute(name: string, title: string) {
  return {
    name,
    title,
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
  };
}

function makeInvoiceProfileEntity() {
  return makeProfileEntity(
    {
      name: "invoice",
      description: "",
      _links: {
        self: { href: `${BASE}/profile/invoices` },
        describes: [
          { href: COLLECTION_URL, name: "collection" },
          { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            name: "blueprint",
            templated: true,
          },
        ],
      },
      _embedded: {
        "blueprint:attribute": [makeAttribute("number", "Number")],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: COLLECTION_URL,
          properties: [{ name: "number~prefix", type: "text" }],
        },
      },
    },
    "invoices",
    "invoice",
  );
}

function makeInvoiceProfileEntityWithoutSearchTemplate() {
  return makeProfileEntity(
    {
      name: "invoice",
      description: "",
      _links: {
        self: { href: `${BASE}/profile/invoices` },
        describes: [
          { href: COLLECTION_URL, name: "collection" },
          { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            name: "blueprint",
            templated: true,
          },
        ],
      },
      _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    },
    "invoices",
    "invoice",
  );
}

function makeInvoiceProfileEntityWithStatus() {
  return makeProfileEntity(
    {
      name: "invoice",
      description: "",
      _links: {
        self: { href: `${BASE}/profile/invoices` },
        describes: [
          { href: COLLECTION_URL, name: "collection" },
          { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
        ],
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
          makeAttribute("number", "Number"),
          makeAttribute("status", "Status"),
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: COLLECTION_URL,
          properties: [
            { name: "number~prefix", type: "text" },
            { name: "status", type: "text" },
          ],
        },
      },
    },
    "invoices",
    "invoice",
  );
}

function halCollection(items: Record<string, unknown>[]) {
  return {
    _links: { self: { href: COLLECTION_URL } },
    _embedded: {
      item: items.map((d, i) => ({
        ...d,
        _links: { self: { href: `${COLLECTION_URL}/${i}` } },
      })),
    },
  };
}

function mockCollection(items: Record<string, unknown>[] = [], onRequest?: (url: URL) => void) {
  server.use(
    http.get(COLLECTION_URL, ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(halCollection(items));
    }),
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
  const profileEntity = makeInvoiceProfileEntity();
  const searchProperty = profileEntity.searchTemplate!.getSearchPropertyByName("number~prefix")!;

  describe("when the profile entity has no search template", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fetch and returns empty results", () => {
      const entityWithoutSearchTemplate = makeInvoiceProfileEntityWithoutSearchTemplate();

      const { result } = makeHook(entityWithoutSearchTemplate, searchProperty);
      act(() => result.current.search("INV"));
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

      act(() => result.current.search("INV"));

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

      act(() => result.current.search("I"));
      act(() => vi.advanceTimersByTime(1000));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
    });
  });

  it("fires only once when search is called rapidly", async () => {
    let requestCount = 0;
    mockCollection([{ number: "INV-001" }], () => requestCount++);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.search("IN"));
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });
    expect(requestCount).toBe(1);
  });

  it("returns results after the debounce delay", async () => {
    mockCollection([{ number: "INV-001" }, { number: "INV-002" }]);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });
    expect(result.current.results).toContain("INV-002");
  });

  it("clears results immediately when query is reset to empty", async () => {
    mockCollection([{ number: "INV-001" }]);

    const { result } = makeHook(profileEntity, searchProperty);

    act(() => result.current.search("INV"));
    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });

    act(() => result.current.search(""));
    expect(result.current.results).toEqual([]);
  });

  it("exposes isError when the fetch fails", async () => {
    server.use(http.get(COLLECTION_URL, () => HttpResponse.error()));

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.results).toEqual([]);
  });

  it("sends the search property name as the URL query parameter", async () => {
    let capturedUrl: URL | undefined;
    mockCollection([{ number: "INV-001" }], (url) => {
      capturedUrl = url;
    });

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });

    expect(capturedUrl?.searchParams.get("number~prefix")).toBe("INV");
  });

  it("deduplicates identical attribute values from multiple items", async () => {
    mockCollection([{ number: "INV-001" }, { number: "INV-001" }, { number: "INV-002" }]);

    const { result } = makeHook(profileEntity, searchProperty);
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toHaveLength(2), { timeout: 3000 });
    expect(result.current.results).toContain("INV-001");
    expect(result.current.results).toContain("INV-002");
  });

  describe("searchValues", () => {
    const entityWithStatus = makeInvoiceProfileEntityWithStatus();
    const numberPrefixProperty =
      entityWithStatus.searchTemplate!.getSearchPropertyByName("number~prefix")!;

    it("merges searchValues into the outgoing request URL alongside the prefix filter", async () => {
      let capturedUrl: URL | undefined;
      mockCollection([{ number: "INV-001" }], (url) => {
        capturedUrl = url;
      });

      const searchValues = createValues(entityWithStatus.searchTemplate!.template).withValue(
        "status",
        "active",
      );

      const qc = makeQueryClient();
      const { result } = renderHook(
        () =>
          useTypeahead({
            profileEntity: entityWithStatus,
            searchProperty: numberPrefixProperty,
            searchValues,
          }),
        { wrapper: makeWrapper(qc) },
      );

      act(() => result.current.search("INV"));
      await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });

      expect(capturedUrl?.searchParams.get("number~prefix")).toBe("INV");
      expect(capturedUrl?.searchParams.get("status")).toBe("active");
    });
  });
});
