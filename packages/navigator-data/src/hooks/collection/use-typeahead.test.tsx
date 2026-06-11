import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test-setup";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import { useTypeahead } from "./use-typeahead";

const COLLECTION_URL = `${BASE}/invoices`;

function mockCollection(items: Record<string, unknown>[] = []) {
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

function makeHook(qc = makeQueryClient()) {
  return renderHook(
    () =>
      useTypeahead({
        entityName: "invoice",
        collectionHref: COLLECTION_URL,
        attributeName: "number",
      }),
    { wrapper: makeWrapper(qc) },
  );
}

describe("useTypeahead", () => {
  describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not fire before the debounce delay", () => {
      // No MSW handler — if a request fires MSW throws (onUnhandledRequest: "error")
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
    server.use(
      http.get(COLLECTION_URL, () => {
        requestCount++;
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [{ number: "INV-001", _links: { self: { href: `${COLLECTION_URL}/1` } } }],
          },
        });
      }),
    );

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
});
