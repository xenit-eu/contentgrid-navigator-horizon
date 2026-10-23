import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createValues } from "@contentgrid/hal-forms/values";
import {
  SEARCH_BAR_COLLECTION_URL,
  SEARCH_BAR_CUSTOMER_COLLECTION_URL,
  makeSearchBarProfiles,
  searchBarHandlers,
} from "../../../test-fixtures/msw/search-bar-fixtures";
import { server } from "../../../test-setup";
import ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import { makeQueryClient, makeWrapper } from "../test-utils";
import {
  type SearchParamSuggestionRequest,
  useSearchParamSuggestions,
} from "./use-search-param-suggestions";

const { searchBar } = makeSearchBarProfiles();
const template = searchBar.searchTemplate!;
const property = (name: string): SearchHalFormTemplateProperty =>
  template.getSearchPropertyByName(name)!;
const request = (name: string, withSuggestions = true): SearchParamSuggestionRequest => ({
  searchProperty: property(name),
  withSuggestions,
});

/** Records every request URL per collection path. */
function recordRequests() {
  const seen: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    seen.push(new URL(request.url));
  });
  return {
    to: (collectionUrl: string) =>
      seen.filter((url) => `${url.origin}${url.pathname}` === collectionUrl),
  };
}

function renderSuggestions(props: {
  requests: readonly SearchParamSuggestionRequest[];
  query: string;
  searchValues?: Parameters<typeof useSearchParamSuggestions>[0]["searchValues"];
}) {
  return renderHook(
    (p: typeof props) =>
      useSearchParamSuggestions({
        profileEntity: searchBar,
        requests: p.requests,
        query: p.query,
        searchValues: p.searchValues,
      }),
    { wrapper: makeWrapper(makeQueryClient()), initialProps: props },
  );
}

describe("useSearchParamSuggestions", () => {
  beforeEach(() => {
    server.events.removeAllListeners();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes one request for a direct prefix parameter and returns values and the exact count", async () => {
    server.use(...searchBarHandlers({ resolveTotal: () => 27 }));
    const requests = recordRequests();

    const { result } = renderSuggestions({ requests: [request("title~prefix")], query: "Al" });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(result.current.results[0]).toMatchObject({
      name: "title~prefix",
      suggestions: ["Alpha invoice", "Alpha order", "Beta contract"],
      totalItems: { count: 27, isEstimated: false },
    });
    const calls = requests.to(SEARCH_BAR_COLLECTION_URL);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.get("title~prefix")).toBe("Al");
  });

  it("reports an estimated total as estimated", async () => {
    server.use(...searchBarHandlers({ totals: "estimate", resolveTotal: () => 1000 }));

    const { result } = renderSuggestions({ requests: [request("notes~fts")], query: "adv" });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(result.current.results[0]?.totalItems).toEqual({ count: 1000, isEstimated: true });
  });

  it("takes relation suggestions from the target entity and the count from the current one", async () => {
    server.use(...searchBarHandlers({ resolveTotal: () => 4 }));
    const requests = recordRequests();

    const { result } = renderSuggestions({
      requests: [request("customer.name~prefix")],
      query: "Ac",
    });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(result.current.results[0]).toMatchObject({
      suggestions: ["Acme Corp", "Acme Logistics"],
      totalItems: { count: 4, isEstimated: false },
    });
    expect(
      requests.to(SEARCH_BAR_CUSTOMER_COLLECTION_URL)[0]?.searchParams.get("name~prefix"),
    ).toBe("Ac");
    const countCall = requests.to(SEARCH_BAR_COLLECTION_URL)[0];
    expect(countCall?.searchParams.get("customer.name~prefix")).toBe("Ac");
  });

  it("keeps the count when the relation target rejects the value, without throwing", async () => {
    server.use(...searchBarHandlers({ resolveTotal: () => 4 }));
    const original = ProfileEntity.prototype.searchEntityRequest;
    vi.spyOn(ProfileEntity.prototype, "searchEntityRequest").mockImplementation(function (
      this: ProfileEntity,
      values,
    ) {
      if (this.name === "customer") throw new Error("target rejects the value");
      return original.call(this, values);
    });
    const requests = recordRequests();

    const { result } = renderSuggestions({
      requests: [request("customer.name~prefix")],
      query: "Ac",
    });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(result.current.results[0]).toMatchObject({
      suggestions: [],
      totalItems: { count: 4, isEstimated: false },
    });
    expect(requests.to(SEARCH_BAR_CUSTOMER_COLLECTION_URL)).toHaveLength(0);
  });

  it("carries the active filters into the count request", async () => {
    server.use(...searchBarHandlers());
    const requests = recordRequests();
    const searchValues = createValues(template.template).withValue("urgent", true);

    const { result } = renderSuggestions({
      requests: [request("title~prefix")],
      query: "Al",
      searchValues,
    });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    const call = requests.to(SEARCH_BAR_COLLECTION_URL)[0];
    expect(call?.searchParams.get("urgent")).toBe("true");
    expect(call?.searchParams.get("title~prefix")).toBe("Al");
  });

  it("fetches only the count when suggestions are not wanted", async () => {
    server.use(...searchBarHandlers({ resolveTotal: () => 2 }));

    const { result } = renderSuggestions({ requests: [request("status", false)], query: "app" });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(result.current.results[0]).toMatchObject({
      suggestions: [],
      totalItems: { count: 2, isEstimated: false },
    });
  });

  it("reports a failure as an error that refetch retries", async () => {
    server.use(...searchBarHandlers());
    let calls = 0;
    server.use(
      http.get(SEARCH_BAR_COLLECTION_URL, () => {
        calls++;
        return HttpResponse.json({ status: 500, title: "Boom" }, { status: 500 });
      }),
    );

    const { result } = renderSuggestions({ requests: [request("title~prefix")], query: "Al" });

    await waitFor(() => expect(result.current.results[0]?.status).toBe("error"), {
      timeout: 3000,
    });
    expect(result.current.results[0]?.error).toBeInstanceOf(Error);
    expect(calls).toBe(1);

    result.current.results[0]?.refetch();
    await waitFor(() => expect(calls).toBe(2), { timeout: 3000 });
  });

  it("makes no request below the minimum length", async () => {
    server.use(...searchBarHandlers());
    const requests = recordRequests();

    const { result } = renderSuggestions({ requests: [request("title~prefix")], query: "   " });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(result.current.results[0]?.status).toBe("idle");
    expect(requests.to(SEARCH_BAR_COLLECTION_URL)).toHaveLength(0);
  });

  it("makes no request for a number parameter when the query is not a number", async () => {
    server.use(...searchBarHandlers());
    const requests = recordRequests();

    const { result } = renderSuggestions({ requests: [request("quantity", false)], query: "abc" });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(result.current.results[0]?.status).toBe("idle");
    expect(requests.to(SEARCH_BAR_COLLECTION_URL)).toHaveLength(0);
  });

  it.each(["1e3", "0x1A", "1,000.5"])(
    "treats %s as not a number for a number parameter",
    async (query) => {
      server.use(...searchBarHandlers());
      const requests = recordRequests();
      const { result } = renderSuggestions({ requests: [request("quantity", false)], query });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(result.current.results[0]?.status).toBe("idle");
      expect(requests.to(SEARCH_BAR_COLLECTION_URL)).toHaveLength(0);
    },
  );

  it("accepts a decimal comma for a number parameter", async () => {
    server.use(...searchBarHandlers());
    const requests = recordRequests();
    const { result } = renderSuggestions({ requests: [request("quantity", false)], query: "2,5" });
    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
    expect(requests.to(SEARCH_BAR_COLLECTION_URL)[0]?.searchParams.get("quantity")).toBe("2.5");
  });

  it("reports loading, not idle, from the first keystroke until the debounce ends", () => {
    server.use(...searchBarHandlers());
    const { result, rerender } = renderSuggestions({
      requests: [request("title~prefix"), request("quantity", false)],
      query: "",
    });
    rerender({ requests: [request("title~prefix"), request("quantity", false)], query: "a" });
    expect(result.current.results.map((r) => r.status)).toEqual(["loading", "idle"]);
  });

  it("gives every idle request its own query, without TanStack's duplicate-query warning", async () => {
    server.use(...searchBarHandlers());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderSuggestions({
      requests: [request("title~prefix"), request("notes~fts"), request("quantity", false)],
      query: "",
    });
    expect(result.current.results.map((r) => r.status)).toEqual(["idle", "idle", "idle"]);
    const messages = [...warn.mock.calls, ...error.mock.calls].flat().join(" ");
    expect(messages).not.toMatch(/Duplicate Queries/);
    warn.mockRestore();
    error.mockRestore();
  });

  it("never presents an older query's suggestions as the answer to a newer one", async () => {
    server.use(...searchBarHandlers());
    const { result, rerender } = renderSuggestions({
      requests: [request("title~prefix")],
      query: "Al",
    });
    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });

    rerender({ requests: [request("title~prefix")], query: "Alp" });

    // Until the newer query has been answered, the result is loading — not the "Al" answer.
    expect(result.current.results[0]?.status).toBe("loading");
    expect(result.current.results[0]?.suggestions).toEqual([]);
    await waitFor(() => expect(result.current.debouncedQuery).toBe("Alp"), { timeout: 3000 });
    await waitFor(() => expect(result.current.results[0]?.status).toBe("success"), {
      timeout: 3000,
    });
  });
});
