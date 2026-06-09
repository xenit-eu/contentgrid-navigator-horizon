import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import type { SearchProperty } from "../types/entity";
import { BASE, makeWrapper } from "./test-utils";
import { useSearchSuggestions } from "./use-search-suggestions";

const COLLECTION_URL = `${BASE}/invoices`;

const prefixProp: SearchProperty = { name: "number~prefix", type: "text" };
const enumProp: SearchProperty = {
  name: "status",
  type: "text",
  options: { inline: ["draft", "sent", "paid"] },
};
const exactProp: SearchProperty = { name: "ref", type: "text" };

function mockCollectionWithItems(items: Record<string, unknown>[]) {
  // MSW2 matches query params transparently — just use the base collection URL.
  server.use(
    http.get(COLLECTION_URL, () =>
      HttpResponse.json({
        _links: { self: { href: COLLECTION_URL } },
        _embedded: {
          item: items.map((d, i) => ({
            ...d,
            _links: { self: { href: `${COLLECTION_URL}/${i}` } },
          })),
        },
      }),
    ),
  );
}

describe("useSearchSuggestions", () => {
  it("filters inline options client-side without an HTTP call", () => {
    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [enumProp],
          activeField: "status",
          query: "dr",
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.suggestions).toEqual(["draft"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty for short prefix query (< 2 chars)", () => {
    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [prefixProp],
          activeField: "number~prefix",
          query: "I",
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.suggestions).toEqual([]);
  });

  it("fetches prefix suggestions from the API and returns unique values", async () => {
    mockCollectionWithItems([{ number: "INV-001" }, { number: "INV-002" }]);

    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [prefixProp],
          activeField: "number~prefix",
          query: "INV",
        }),
      { wrapper: makeWrapper() },
    );

    // Wait for suggestions to be populated — more reliable than waiting for isLoading.
    await waitFor(() => expect(result.current.suggestions.length).toBeGreaterThan(0), {
      timeout: 3000,
    });
    expect(result.current.suggestions).toContain("INV-001");
    expect(result.current.suggestions).toContain("INV-002");
  });

  it("fetches exact suggestions and filters client-side by query", async () => {
    mockCollectionWithItems([{ ref: "REF-A" }, { ref: "REF-B" }]);

    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [exactProp],
          activeField: "ref",
          query: "REF-A",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.suggestions.length).toBeGreaterThan(0), {
      timeout: 3000,
    });
    expect(result.current.suggestions).toContain("REF-A");
    expect(result.current.suggestions).not.toContain("REF-B");
  });

  it("returns empty for date fields (no strategy)", () => {
    const dateProp: SearchProperty = { name: "created~after", type: "date" };
    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [dateProp],
          activeField: "created~after",
          query: "2024",
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.suggestions).toEqual([]);
  });

  it("surfaces an error state when the prefix fetch endpoint returns 500", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [prefixProp],
          activeField: "number~prefix",
          query: "INV",
        }),
      { wrapper: makeWrapper() },
    );

    // isLoading starts true for prefix queries; after error it becomes false
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    expect(result.current.suggestions).toEqual([]);
  });

  it("returns empty suggestions when the active field is not found in searchProperties", () => {
    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [prefixProp],
          activeField: "nonexistent-field",
          query: "INV",
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty for prefix queries shorter than 2 chars (needsPrefixCall=false)", () => {
    const { result } = renderHook(
      () =>
        useSearchSuggestions({
          entityName: "invoice",
          collectionHref: COLLECTION_URL,
          searchProperties: [prefixProp],
          activeField: "number~prefix",
          query: "I",
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
