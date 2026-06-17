import { describe, expect, it } from "vitest";
import {
  getBaseFieldName,
  getValueField,
  isDateOperatorField,
  isPrefixSearchable,
  isRelationSearchField,
  searchPropertyLabel,
} from "./search-property";

describe("isPrefixSearchable", () => {
  it("returns true for ~prefix suffix", () => {
    expect(isPrefixSearchable("number~prefix")).toBe(true);
  });
  it("returns true for ~prefix-match suffix", () => {
    expect(isPrefixSearchable("number~prefix-match")).toBe(true);
  });
  it("returns true for relation path with ~prefix", () => {
    expect(isPrefixSearchable("supplier.name~prefix")).toBe(true);
  });
  it("returns false for exact-match fields", () => {
    expect(isPrefixSearchable("status")).toBe(false);
  });
  it("returns false for date operator fields", () => {
    expect(isPrefixSearchable("created~before")).toBe(false);
    expect(isPrefixSearchable("created~after")).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isPrefixSearchable("")).toBe(false);
  });
});

describe("isRelationSearchField", () => {
  it("returns true when name contains a dot", () => {
    expect(isRelationSearchField("supplier.name")).toBe(true);
  });
  it("returns true for relation path with operator suffix", () => {
    expect(isRelationSearchField("supplier.name~prefix")).toBe(true);
  });
  it("returns true for deeply nested path", () => {
    expect(isRelationSearchField("a.b.c")).toBe(true);
  });
  it("returns false for simple field name", () => {
    expect(isRelationSearchField("number")).toBe(false);
  });
  it("returns false for ~prefix field without relation traversal", () => {
    expect(isRelationSearchField("number~prefix")).toBe(false);
  });
});

describe("isDateOperatorField", () => {
  it("returns true for ~before suffix", () => {
    expect(isDateOperatorField("created~before")).toBe(true);
  });
  it("returns true for ~after suffix", () => {
    expect(isDateOperatorField("created~after")).toBe(true);
  });
  it("returns false for ~prefix suffix", () => {
    expect(isDateOperatorField("number~prefix")).toBe(false);
  });
  it("returns false for plain field name", () => {
    expect(isDateOperatorField("status")).toBe(false);
  });
});

describe("getBaseFieldName", () => {
  it("strips ~prefix operator suffix", () => {
    expect(getBaseFieldName("number~prefix")).toBe("number");
  });
  it("strips ~prefix-match operator suffix", () => {
    expect(getBaseFieldName("number~prefix-match")).toBe("number");
  });
  it("strips ~before operator suffix", () => {
    expect(getBaseFieldName("created~before")).toBe("created");
  });
  it("strips operator from a relation path", () => {
    expect(getBaseFieldName("supplier.name~prefix")).toBe("supplier.name");
  });
  it("returns the name unchanged when there is no tilde", () => {
    expect(getBaseFieldName("status")).toBe("status");
  });
});

describe("getValueField", () => {
  it("returns the field unchanged for a simple name", () => {
    expect(getValueField("number")).toBe("number");
  });
  it("returns the last segment for a dot-notation path", () => {
    expect(getValueField("supplier.name")).toBe("name");
  });
  it("returns the deepest leaf for a multi-level path", () => {
    expect(getValueField("a.b.c")).toBe("c");
  });
  it("composes correctly with getBaseFieldName for operator fields", () => {
    expect(getValueField(getBaseFieldName("supplier.name~prefix"))).toBe("name");
    expect(getValueField(getBaseFieldName("number~prefix"))).toBe("number");
  });
});

describe("searchPropertyLabel", () => {
  it("strips operator suffix for a simple field", () => {
    expect(searchPropertyLabel("number~prefix")).toBe("number");
  });
  it("converts dot to space for a relation path", () => {
    expect(searchPropertyLabel("supplier.name~prefix")).toBe("supplier name");
  });
  it("returns the name as-is when there is no operator or dot", () => {
    expect(searchPropertyLabel("status")).toBe("status");
  });
  it("only replaces the first dot (String.replace without /g flag)", () => {
    expect(searchPropertyLabel("a.b.c~prefix")).toBe("a b.c");
  });
});
