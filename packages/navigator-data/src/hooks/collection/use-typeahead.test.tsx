import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test-setup";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import { useTypeahead } from "./use-typeahead";

const COLLECTION_URL = `${BASE}/invoices`;

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

/**
 * Register an MSW handler for GET COLLECTION_URL.
 * onRequest is called on every matched request — use it to count hits or inspect the URL.
 */
function mockCollection(items: Record<string, unknown>[] = [], onRequest?: (url: URL) => void) {
  server.use(
    http.get(COLLECTION_URL, ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(halCollection(items));
    }),
  );
}

function makeHook(qc = makeQueryClient(), filterParam = "number~prefix") {
  return renderHook(
    () =>
      useTypeahead({
        entityName: "invoice",
        collectionHref: COLLECTION_URL,
        filterParam,
      }),
    { wrapper: makeWrapper(qc) },
  );
}

describe("useTypeahead", () => {
  describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fire before the debounce delay", () => {
      // No MSW handler registered — any request would fail with onUnhandledRequest: "error"
      const { result } = makeHook();

      act(() => result.current.search("INV"));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);

      act(() => vi.advanceTimersByTime(249));
      expect(result.current.isLoading).toBe(false);
    });

    it("does not fire for input shorter than minLength", () => {
      const { result } = makeHook();

      act(() => result.current.search("I"));
      // Advance well past debounce delay — debouncedQuery="I" but enabled=false
      act(() => vi.advanceTimersByTime(1000));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
    });
  });

  it("fires only once when search is called rapidly", async () => {
    let requestCount = 0;
    mockCollection([{ number: "INV-001" }], () => requestCount++);

    const { result } = makeHook();

    // Two rapid searches — the first timer is cancelled before it fires
    act(() => result.current.search("IN"));
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });
    expect(requestCount).toBe(1);
  });

  it("returns results after the debounce delay", async () => {
    mockCollection([{ number: "INV-001" }, { number: "INV-002" }]);

    const { result } = makeHook();

    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });
    expect(result.current.results).toContain("INV-002");
  });

  it("clears results when query is reset to empty", async () => {
    mockCollection([{ number: "INV-001" }]);

    const { result } = makeHook();

    act(() => result.current.search("INV"));
    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });

    act(() => result.current.search(""));
    await waitFor(() => expect(result.current.results).toEqual([]), { timeout: 3000 });
  });

  it("sends filterParam as the URL query parameter", async () => {
    let capturedUrl: URL | undefined;
    mockCollection([{ number: "INV-001" }], (url) => {
      capturedUrl = url;
    });

    const { result } = makeHook();
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toContain("INV-001"), { timeout: 3000 });

    expect(capturedUrl?.searchParams.get("number~prefix")).toBe("INV");
    expect(capturedUrl?.searchParams.get("size")).toBe("10");
  });

  it("extracts the leaf field for dot-notation filter params", async () => {
    // "document.title~prefix" → valueField = "title" (leaf segment before "~")
    // Consistent with use-search-suggestions.ts valueField derivation.
    mockCollection([{ title: "Contract A" }]);

    const { result } = makeHook(makeQueryClient(), "document.title~prefix");
    act(() => result.current.search("Con"));

    await waitFor(() => expect(result.current.results).toContain("Contract A"), { timeout: 3000 });
  });

  it("deduplicates identical attribute values from multiple items", async () => {
    mockCollection([{ number: "INV-001" }, { number: "INV-001" }, { number: "INV-002" }]);

    const { result } = makeHook();
    act(() => result.current.search("INV"));

    await waitFor(() => expect(result.current.results).toHaveLength(2), { timeout: 3000 });
    expect(result.current.results).toContain("INV-001");
    expect(result.current.results).toContain("INV-002");
  });
});
