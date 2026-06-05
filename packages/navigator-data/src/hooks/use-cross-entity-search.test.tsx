import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeWrapper } from "./test-utils";
import { useCrossEntitySearch } from "./use-cross-entity-search";

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
});
