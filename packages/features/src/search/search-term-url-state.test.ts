import { describe, expect, it } from "vitest";
import {
  applySearchTermToSearchState,
  decodeSearchTermFromSearchState,
} from "./search-term-url-state";

describe("decodeSearchTermFromSearchState", () => {
  it("returns undefined when no q key is present", () => {
    expect(decodeSearchTermFromSearchState({})).toBeUndefined();
  });

  it("returns the search term when present", () => {
    expect(decodeSearchTermFromSearchState({ q: "Acme Corp" })).toBe("Acme Corp");
  });
});

describe("applySearchTermToSearchState", () => {
  it("adds the q key when previously absent", () => {
    expect(applySearchTermToSearchState({}, "Acme Corp")).toEqual({ q: "Acme Corp" });
  });

  it("replaces an existing search term", () => {
    expect(applySearchTermToSearchState({ q: "Acme Corp" }, "Acme Industries")).toEqual({
      q: "Acme Industries",
    });
  });

  it("removes the q key entirely when passed undefined", () => {
    const result = applySearchTermToSearchState({ q: "Acme Corp" }, undefined);
    expect(result).toEqual({});
    expect("q" in result).toBe(false);
  });

  it("removes the q key entirely when passed an empty string", () => {
    const result = applySearchTermToSearchState({ q: "Acme Corp" }, "");
    expect(result).toEqual({});
    expect("q" in result).toBe(false);
  });

  it("leaves every other key (including sort and s.* filters) untouched", () => {
    const result = applySearchTermToSearchState(
      { "s.code~prefix": "abc", sort: "name,asc", q: "old" },
      "Acme Corp",
    );
    expect(result).toEqual({ "s.code~prefix": "abc", sort: "name,asc", q: "Acme Corp" });
  });

  it("round-trips with decodeSearchTermFromSearchState", () => {
    const state = applySearchTermToSearchState({}, "Acme Corp");
    expect(decodeSearchTermFromSearchState(state)).toBe("Acme Corp");
  });
});
