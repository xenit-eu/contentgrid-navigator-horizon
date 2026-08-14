import { describe, expect, it } from "vitest";
import { entitySearchStateValidator } from "./entity-search-state";

describe("entitySearchStateValidator", () => {
  it("passes any string-valued key through — not limited to cursor", () => {
    expect(entitySearchStateValidator({ cursor: "0p4jtvf1", sort: "name,asc" })).toEqual({
      cursor: "0p4jtvf1",
      sort: "name,asc",
    });
  });

  it("returns empty object when no keys are present", () => {
    expect(entitySearchStateValidator({})).toEqual({});
  });

  it("drops non-string values", () => {
    expect(entitySearchStateValidator({ cursor: 42, other: null })).toEqual({});
  });
});
