import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_BAR_COLLECTION_URL,
  SEARCH_BAR_CUSTOMER_COLLECTION_URL,
  makeSearchBarProfiles,
  searchBarHandlers,
} from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { server } from "../../test-setup";
import { makeSearchBarWrapper } from "./test-utils";
import { useEntitySearchBar } from "./use-entity-search-bar";

const { searchBar } = makeSearchBarProfiles();

function recordRequests() {
  const seen: URL[] = [];
  server.events.removeAllListeners();
  server.events.on("request:start", ({ request }) => {
    seen.push(new URL(request.url));
  });
  return (collectionUrl: string) =>
    seen.filter((url) => `${url.origin}${url.pathname}` === collectionUrl);
}

function renderSearchBar(filters: Record<string, string> = {}) {
  const onFiltersChange = vi.fn();
  const hook = renderHook(
    () => useEntitySearchBar({ profileEntity: searchBar, filters, onFiltersChange }),
    { wrapper: makeSearchBarWrapper() },
  );
  return { ...hook, onFiltersChange };
}

async function waitForDescriptors(result: { current: ReturnType<typeof useEntitySearchBar> }) {
  // Relation parameters are typed once the target profiles have loaded.
  await waitFor(() =>
    expect(
      result.current.descriptors.find((d) => d.name === "customer.name~prefix")?.attributeLabel,
    ).toBe("Name"),
  );
}

describe("useEntitySearchBar — main bar", () => {
  beforeEach(() => {
    server.use(...searchBarHandlers({ resolveTotal: () => 3 }));
  });

  it("opens the popover in 'All' mode and searches every prefix and full-text parameter", async () => {
    const requestsTo = recordRequests();
    const { result } = renderSearchBar();
    await waitForDescriptors(result);

    act(() => result.current.input.setValue("Al"));

    expect(result.current.input.popoverOpen).toBe(true);
    await waitFor(
      () =>
        expect(
          result.current.input.groups.find((g) => g.descriptor.name === "title~prefix")?.status,
        ).toBe("ready"),
      { timeout: 3000 },
    );
    const searched = requestsTo(SEARCH_BAR_COLLECTION_URL).flatMap((url) =>
      [...url.searchParams.keys()].filter((k) => k.includes("~prefix") || k.includes("~fts")),
    );
    expect(new Set(searched)).toEqual(
      new Set(["title~prefix", "notes~fts", "customer.name~prefix", "owner.email~prefix"]),
    );
    expect(requestsTo(SEARCH_BAR_CUSTOMER_COLLECTION_URL)).not.toHaveLength(0);
    expect(result.current.input.paramChips.map((c) => c.descriptor.name)).toContain("reference");
  });

  it("applies a picked suggestion, clears the input and returns to 'All'", async () => {
    const { result, onFiltersChange } = renderSearchBar({ urgent: "true" });
    await waitForDescriptors(result);
    act(() => result.current.input.setMode({ kind: "param", name: "notes~fts" }));
    act(() => result.current.input.setValue("adv"));

    act(() => result.current.input.applySuggestion("title~prefix", "Alpha invoice"));

    expect(onFiltersChange).toHaveBeenCalledWith({
      urgent: "true",
      "title~prefix": "Alpha invoice",
    });
    expect(result.current.input.value).toBe("");
    expect(result.current.input.mode).toEqual({ kind: "all" });
    expect(result.current.input.popoverOpen).toBe(false);
  });

  it("searches only the selected prefix parameter", async () => {
    const requestsTo = recordRequests();
    const { result } = renderSearchBar();
    await waitForDescriptors(result);

    act(() => result.current.input.setMode({ kind: "param", name: "notes~fts" }));
    act(() => result.current.input.setValue("adv"));

    await waitFor(() => expect(result.current.input.groups[0]?.status).toBe("ready"), {
      timeout: 3000,
    });
    expect(result.current.input.groups.map((g) => g.descriptor.name)).toEqual(["notes~fts"]);
    expect(result.current.input.paramChips).toEqual([]);
    const params = requestsTo(SEARCH_BAR_COLLECTION_URL).map((url) => [...url.searchParams.keys()]);
    expect(
      params.every((keys) => keys.includes("notes~fts") && !keys.includes("title~prefix")),
    ).toBe(true);
  });

  it("filters allowed values on the client and only requests their count", async () => {
    const requestsTo = recordRequests();
    const { result } = renderSearchBar();
    await waitForDescriptors(result);

    act(() => result.current.input.setMode({ kind: "param", name: "status" }));
    act(() => result.current.input.setValue("dr"));

    expect(result.current.input.groups[0]?.items).toEqual([{ value: "draft", label: "draft" }]);
    await waitFor(
      () =>
        expect(result.current.input.groups[0]?.count).toEqual({
          status: "known",
          count: 3,
          isEstimated: false,
        }),
      { timeout: 3000 },
    );
    expect(
      requestsTo(SEARCH_BAR_COLLECTION_URL).every((url) => url.searchParams.get("status") === "dr"),
    ).toBe(true);
  });

  it.each(["reference", "quantity", "amount"])(
    "opens no popover for the exact / number parameter %s",
    async (name) => {
      const { result } = renderSearchBar();
      await waitForDescriptors(result);
      act(() => result.current.input.setMode({ kind: "param", name }));
      act(() => result.current.input.setValue("42"));
      expect(result.current.input.popoverOpen).toBe(false);
    },
  );

  it("applies typed text with Enter for a selected parameter", async () => {
    const { result, onFiltersChange } = renderSearchBar();
    await waitForDescriptors(result);
    act(() => result.current.input.setMode({ kind: "param", name: "quantity" }));
    act(() => result.current.input.setValue("42"));

    act(() => result.current.input.submit());

    expect(onFiltersChange).toHaveBeenCalledWith({ quantity: "42" });
    expect(result.current.input.value).toBe("");
    expect(result.current.input.mode).toEqual({ kind: "all" });
  });

  it("applies the typed text as the prefix value when no suggestion was picked", async () => {
    const { result, onFiltersChange } = renderSearchBar();
    await waitForDescriptors(result);
    act(() => result.current.input.setMode({ kind: "param", name: "title~prefix" }));
    act(() => result.current.input.setValue("Alp"));
    act(() => result.current.input.submit());
    expect(onFiltersChange).toHaveBeenCalledWith({ "title~prefix": "Alp" });
  });

  it("refuses an invalid value and explains why, without applying anything", async () => {
    const { result, onFiltersChange } = renderSearchBar();
    await waitForDescriptors(result);
    act(() => result.current.input.setMode({ kind: "param", name: "quantity" }));
    act(() => result.current.input.setValue("4.2"));

    act(() => result.current.input.submit());

    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(result.current.input.error).toBe("Enter a whole number");
    act(() => result.current.input.setValue("4"));
    expect(result.current.input.error).toBeUndefined();
  });

  it("does nothing on Enter in 'All' mode", async () => {
    const { result, onFiltersChange } = renderSearchBar();
    await waitForDescriptors(result);
    act(() => result.current.input.setValue("Alp"));
    act(() => result.current.input.submit());
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it("leaves relation parameters out in 'All except relations' mode", async () => {
    const requestsTo = recordRequests();
    const { result } = renderSearchBar();
    await waitForDescriptors(result);
    act(() => result.current.input.setMode({ kind: "all-direct" }));
    act(() => result.current.input.setValue("Al"));

    await waitFor(
      () => expect(result.current.input.groups.some((g) => g.status === "ready")).toBe(true),
      { timeout: 3000 },
    );
    expect(result.current.input.paramChips.some((c) => c.descriptor.relation)).toBe(false);
    expect(result.current.input.groups.some((g) => g.descriptor.relation)).toBe(false);
    expect(requestsTo(SEARCH_BAR_CUSTOMER_COLLECTION_URL)).toHaveLength(0);
    expect(
      requestsTo(SEARCH_BAR_COLLECTION_URL).some((url) =>
        url.searchParams.has("customer.name~prefix"),
      ),
    ).toBe(false);
  });
});
