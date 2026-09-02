import { describe, expect, it } from "vitest";
import { applyFiltersToSearchState, decodeFiltersFromSearchState } from "./filter-url-state";

describe("decodeFiltersFromSearchState", () => {
  it("strips the s. prefix from filter keys", () => {
    expect(decodeFiltersFromSearchState({ "s.title": "hello", "s.status": "open" })).toEqual({
      title: "hello",
      status: "open",
    });
  });

  it("ignores keys without the s. prefix", () => {
    expect(decodeFiltersFromSearchState({ sort: "name,asc", "s.title": "hello" })).toEqual({
      title: "hello",
    });
  });

  it("drops undefined values", () => {
    expect(decodeFiltersFromSearchState({ "s.title": undefined })).toEqual({});
  });

  it("returns an empty object when there are no s.* keys", () => {
    expect(decodeFiltersFromSearchState({})).toEqual({});
  });
});

describe("applyFiltersToSearchState", () => {
  it("adds new s.* keys for the given filters", () => {
    expect(applyFiltersToSearchState({}, { title: "hello" })).toEqual({ "s.title": "hello" });
  });

  it("leaves non-filter keys untouched", () => {
    expect(applyFiltersToSearchState({ sort: "name,asc" }, { title: "hello" })).toEqual({
      sort: "name,asc",
      "s.title": "hello",
    });
  });

  it("replaces the entire s.* slice — drops a filter that's no longer present", () => {
    expect(
      applyFiltersToSearchState({ "s.title": "hello", "s.status": "open" }, { title: "hi" }),
    ).toEqual({ "s.title": "hi" });
  });

  it("clears all filters when given an empty map, keeping other keys", () => {
    expect(applyFiltersToSearchState({ sort: "name,asc", "s.title": "hello" }, {})).toEqual({
      sort: "name,asc",
    });
  });

  it("round-trips with decodeFiltersFromSearchState", () => {
    const filters = { title: "hello", status: "open" };
    const state = applyFiltersToSearchState({}, filters);
    expect(decodeFiltersFromSearchState(state)).toEqual(filters);
  });
});
