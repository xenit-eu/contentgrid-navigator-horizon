import { describe, expect, it, vi } from "vitest";
import type { SearchParamSuggestionResult } from "@contentgrid/navigator-data";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import { buildSuggestionModels, suggestionRequestsFor } from "./build-suggestion-models";
import { selectParamChips } from "./select-param-chips";
import type { SelectorMode } from "./types";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);
const ALL: SelectorMode = { kind: "all" };

function result(
  name: string,
  overrides: Partial<SearchParamSuggestionResult> = {},
): SearchParamSuggestionResult {
  return {
    name,
    status: "success",
    suggestions: [],
    totalItems: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function models(results: SearchParamSuggestionResult[], query: string, mode: SelectorMode = ALL) {
  return buildSuggestionModels({
    descriptors,
    chipDescriptors: selectParamChips(descriptors, query.match(/^\d+$/) ? "integer" : "text", mode),
    results,
    query,
    mode,
  });
}

describe("suggestionRequestsFor", () => {
  const names = (mode: SelectorMode) =>
    suggestionRequestsFor(descriptors, mode).map((r) => [r.descriptor.name, r.withSuggestions]);

  it("requests every prefix and full-text parameter in 'All' mode", () => {
    expect(names(ALL)).toEqual([
      ["title~prefix", true],
      ["notes~fts", true],
      ["customer.name~prefix", true],
      ["owner.email~prefix", true],
    ]);
  });

  it("drops relation parameters in 'All except relations' mode", () => {
    expect(names({ kind: "all-direct" })).toEqual([
      ["title~prefix", true],
      ["notes~fts", true],
    ]);
  });

  it("requests only the selected parameter: suggestions, count only, or nothing", () => {
    expect(names({ kind: "param", name: "notes~fts" })).toEqual([["notes~fts", true]]);
    expect(names({ kind: "param", name: "status" })).toEqual([["status", false]]);
    expect(names({ kind: "param", name: "quantity" })).toEqual([]);
  });
});

describe("buildSuggestionModels", () => {
  it("gives searched chips their count and unsearched chips '?'", () => {
    const { chips } = models(
      [
        result("title~prefix", { totalItems: { count: 12, isEstimated: true } }),
        result("notes~fts", { status: "loading" }),
      ],
      "al",
    );
    const byName = new Map(chips.map((c) => [c.descriptor.name, c.count]));
    expect(byName.get("title~prefix")).toEqual({ status: "known", count: 12, isEstimated: true });
    expect(byName.get("notes~fts")).toEqual({ status: "loading" });
    expect(byName.get("reference")).toEqual({ status: "unknown" });
    expect(byName.get("status")).toEqual({ status: "unknown" });
  });

  it("builds one group per searched parameter with results, capped at 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Alpha ${i}`);
    const { groups } = models(
      [
        result("title~prefix", {
          suggestions: many,
          totalItems: { count: 15, isEstimated: false },
        }),
        result("notes~fts", { status: "loading" }),
        result("customer.name~prefix", { status: "error" }),
      ],
      "al",
    );
    expect(groups.map((g) => [g.descriptor.name, g.status, g.items.length])).toEqual([
      ["title~prefix", "ready", 10],
      ["notes~fts", "loading", 0],
      ["customer.name~prefix", "error", 0],
    ]);
    expect(groups[2]?.retry).toBeTypeOf("function");
  });

  it("adds client-filtered allowed-value groups that match the input", () => {
    const { groups } = models([result("title~prefix", { suggestions: [] })], "app");
    expect(groups.map((g) => g.descriptor.name)).toEqual(["status"]);
    expect(groups[0]?.items).toEqual([{ value: "approved", label: "approved" }]);
    expect(groups[0]?.count).toEqual({ status: "unknown" });
  });

  it("keeps every group, each 'No matches', when nothing matched anywhere", () => {
    const { groups } = models(
      [
        result("title~prefix"),
        result("notes~fts"),
        result("customer.name~prefix"),
        result("owner.email~prefix"),
      ],
      "zzz",
    );
    expect(groups.map((g) => g.status)).toEqual(["empty", "empty", "empty", "empty"]);
  });

  it("in parameter mode shows only that parameter's group, with its count", () => {
    const { chips, groups } = models(
      [result("status", { totalItems: { count: 3, isEstimated: false } })],
      "dr",
      { kind: "param", name: "status" },
    );
    expect(chips).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      status: "ready",
      count: { status: "known", count: 3, isEstimated: false },
      items: [{ value: "draft", label: "draft" }],
    });
  });

  it("ignores idle results", () => {
    const { groups } = models([result("title~prefix", { status: "idle" })], "a", {
      kind: "param",
      name: "title~prefix",
    });
    expect(groups).toEqual([]);
  });
});
