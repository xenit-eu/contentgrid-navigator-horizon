import { describe, expect, it } from "vitest";
import { entitySearchStateValidator } from "./entity-search-state";

describe("entitySearchStateValidator", () => {
  it("passes any string-valued key through — not limited to a specific field", () => {
    expect(entitySearchStateValidator({ "s.title": "hello", "s.status": "open" })).toEqual({
      "s.title": "hello",
      "s.status": "open",
    });
  });

  it("returns empty object when no keys are present", () => {
    expect(entitySearchStateValidator({})).toEqual({});
  });

  it("drops non-string values", () => {
    expect(entitySearchStateValidator({ "s.title": 42, other: null })).toEqual({});
  });
});
