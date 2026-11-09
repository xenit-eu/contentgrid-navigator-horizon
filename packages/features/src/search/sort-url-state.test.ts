import { describe, expect, it } from "vitest";
import { applySortToSearchState, decodeSortFromSearchState } from "./sort-url-state";

describe("decodeSortFromSearchState", () => {
  it("returns undefined when no sort key is present", () => {
    expect(decodeSortFromSearchState({})).toBeUndefined();
  });

  it("returns the sort value when present", () => {
    expect(decodeSortFromSearchState({ sort: "name,asc" })).toBe("name,asc");
  });
});

describe("applySortToSearchState", () => {
  it("adds the sort key when previously absent", () => {
    expect(applySortToSearchState({}, "name,asc")).toEqual({ sort: "name,asc" });
  });

  it("replaces an existing sort value", () => {
    expect(applySortToSearchState({ sort: "name,asc" }, "name,desc")).toEqual({
      sort: "name,desc",
    });
  });

  it("removes the sort key entirely when passed undefined", () => {
    const result = applySortToSearchState({ sort: "name,asc" }, undefined);
    expect(result).toEqual({});
    expect("sort" in result).toBe(false);
  });

  it("leaves every other key (including s.* filters) untouched", () => {
    const result = applySortToSearchState(
      { "s.code~prefix": "abc", sort: "name,asc" },
      "total,desc",
    );
    expect(result).toEqual({ "s.code~prefix": "abc", sort: "total,desc" });
  });
});
