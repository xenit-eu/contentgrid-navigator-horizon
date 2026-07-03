import { describe, expect, it } from "vitest";
import { entitySearchStateValidator } from "./entity-search-state";

describe("entitySearchStateValidator", () => {
  it("passes s.cursor through when valid", () => {
    expect(
      entitySearchStateValidator({ "s.cursor": "https://api.example.com/invoices?cursor=abc" }),
    ).toEqual({
      "s.cursor": "https://api.example.com/invoices?cursor=abc",
    });
  });

  it("returns empty object when s.cursor is absent", () => {
    expect(entitySearchStateValidator({})).toEqual({});
  });

  it("returns empty object when s.cursor is not a string", () => {
    expect(entitySearchStateValidator({ "s.cursor": 42 })).toEqual({});
  });

  it("strips unrecognised keys", () => {
    expect(entitySearchStateValidator({ "s.cursor": "abc", q: "legacy" })).toEqual({
      "s.cursor": "abc",
    });
  });
});
