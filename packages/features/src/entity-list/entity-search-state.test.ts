import { describe, expect, it } from "vitest";
import { validateEntitySearchState } from "./entity-search-state";

describe("validateEntitySearchState", () => {
  it("passes a string cursor through unchanged", () => {
    expect(validateEntitySearchState({ cursor: "0p4jtvf1" })).toEqual({
      cursor: "0p4jtvf1",
    });
  });

  it("returns an empty object when cursor is absent, without inventing a default", () => {
    expect(validateEntitySearchState({})).toEqual({});
  });

  it("drops a non-string cursor instead of passing it through", () => {
    expect(validateEntitySearchState({ cursor: 42 })).toEqual({});
  });

  it("drops unrecognised keys — only cursor is part of this route's search state", () => {
    expect(validateEntitySearchState({ cursor: "abc", "s.cursor": "legacy", q: "legacy" })).toEqual(
      { cursor: "abc" },
    );
  });
});
