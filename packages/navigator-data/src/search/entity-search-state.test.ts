import { describe, expect, it } from "vitest";
import { entitySearchStateValidator, extractCursorFromHref } from "./entity-search-state";

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

describe("extractCursorFromHref", () => {
  it("extracts the _cursor param from an href", () => {
    expect(extractCursorFromHref("https://api.example.com/invoices?_cursor=abc123")).toBe("abc123");
  });

  it("returns undefined when href is undefined", () => {
    expect(extractCursorFromHref(undefined)).toBeUndefined();
  });

  it("returns undefined when href has no _cursor param", () => {
    expect(extractCursorFromHref("https://api.example.com/invoices")).toBeUndefined();
  });

  it("returns undefined (not throwing) when href is unparsable", () => {
    expect(extractCursorFromHref("/relative-no-base")).toBeUndefined();
  });
});
