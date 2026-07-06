import { describe, expect, it } from "vitest";
import {
  IMPLICIT_OPS,
  SEARCH_TYPE_LABELS,
  type SearchProperty,
  formatFieldLabel,
  formatWords,
  isDateProperty,
  isRelationProperty,
  parseName,
} from "./search-property-utils";

describe("parseName", () => {
  it("returns the full name as base with null op when there is no tilde", () => {
    expect(parseName("status")).toEqual({ base: "status", op: null });
  });

  it("splits on first tilde for field~op format", () => {
    expect(parseName("created_at~greater-than")).toEqual({
      base: "created_at",
      op: "greater-than",
    });
  });

  it("splits on .~ for range-pair format and preserves leading tilde in op", () => {
    expect(parseName("amount.~from")).toEqual({ base: "amount", op: "~from" });
  });

  it("prefers .~ over bare ~ when both are present", () => {
    expect(parseName("amount.~until")).toEqual({ base: "amount", op: "~until" });
  });

  it("handles prefix-match operator suffix", () => {
    expect(parseName("number~prefix-match")).toEqual({ base: "number", op: "prefix-match" });
  });

  it("handles full-text operator suffix", () => {
    expect(parseName("notes~full-text")).toEqual({ base: "notes", op: "full-text" });
  });

  it("handles less-than-or-equal (no -to suffix)", () => {
    expect(parseName("due~less-than-or-equal")).toEqual({ base: "due", op: "less-than-or-equal" });
  });

  it("handles greater-than-or-equal (no -to suffix)", () => {
    expect(parseName("due~greater-than-or-equal")).toEqual({
      base: "due",
      op: "greater-than-or-equal",
    });
  });

  it(".~ takes priority over a bare ~ earlier in the name", () => {
    // "score~rank.~from": the ~ at index 5 must NOT be used as the split point
    expect(parseName("score~rank.~from")).toEqual({ base: "score~rank", op: "~from" });
  });
});

describe("formatWords", () => {
  it("capitalises a single word", () => {
    expect(formatWords("status")).toBe("Status");
  });

  it("converts underscores to spaces and capitalises each word", () => {
    expect(formatWords("invoice_number")).toBe("Invoice Number");
  });

  it("converts dots to spaces", () => {
    expect(formatWords("line.item")).toBe("Line Item");
  });

  it("uppercases known acronyms: id", () => {
    expect(formatWords("invoice_id")).toBe("Invoice ID");
  });

  it("uppercases known acronyms: url", () => {
    expect(formatWords("redirect_url")).toBe("Redirect URL");
  });

  it("uppercases known acronyms: uri", () => {
    expect(formatWords("base_uri")).toBe("Base URI");
  });

  it("uppercases known acronyms: api", () => {
    expect(formatWords("api_key")).toBe("API Key");
  });

  it("uppercases known acronyms: uuid", () => {
    expect(formatWords("user_uuid")).toBe("User UUID");
  });
});

describe("formatFieldLabel", () => {
  it("returns prompt when provided", () => {
    const prop: SearchProperty = {
      name: "invoice_date~greater-than",
      prompt: "Invoice date",
      type: "date",
    };
    expect(formatFieldLabel(prop)).toBe("Invoice date");
  });

  it("derives label from base field name when prompt is absent", () => {
    const prop: SearchProperty = { name: "invoice_date~greater-than", type: "date" };
    expect(formatFieldLabel(prop)).toBe("Invoice Date");
  });

  it("strips range-pair .~ suffix before formatting", () => {
    const prop: SearchProperty = { name: "total.~from", type: "string" };
    expect(formatFieldLabel(prop)).toBe("Total");
  });
});

describe("isDateProperty", () => {
  it("returns true when type is 'date'", () => {
    expect(isDateProperty("status", "date")).toBe(true);
  });

  it("returns true when type is 'datetime'", () => {
    expect(isDateProperty("status", "datetime")).toBe(true);
  });

  it("returns true when name ends with ~greater-than", () => {
    expect(isDateProperty("due~greater-than", "string")).toBe(true);
  });

  it("returns true when name ends with ~less-than", () => {
    expect(isDateProperty("due~less-than", "string")).toBe(true);
  });

  it("returns true when name ends with ~greater-than-or-equal", () => {
    expect(isDateProperty("due~greater-than-or-equal", "string")).toBe(true);
  });

  it("returns true when name ends with ~less-than-or-equal", () => {
    expect(isDateProperty("due~less-than-or-equal", "string")).toBe(true);
  });

  it("returns true when name ends with .~from", () => {
    expect(isDateProperty("amount.~from", "string")).toBe(true);
  });

  it("returns true when name ends with .~until", () => {
    expect(isDateProperty("amount.~until", "string")).toBe(true);
  });

  it("returns false for plain string property with no date suffix", () => {
    expect(isDateProperty("status", "string")).toBe(false);
  });

  it("does NOT recognise the wrong -to suffix variant as a date", () => {
    expect(isDateProperty("due~greater-than-or-equal-to", "string")).toBe(false);
    expect(isDateProperty("due~less-than-or-equal-to", "string")).toBe(false);
  });

  it("name-based detection overrides a non-date type: .~from with type 'string' is still a date", () => {
    // range-pair props arrive from the HAL platform typed as "string" or "number" even when
    // their value is always a date; the suffix is the authoritative signal
    expect(isDateProperty("amount.~from", "string")).toBe(true);
    expect(isDateProperty("amount.~until", "number")).toBe(true);
  });

  it("does not match a partial suffix embedded in a longer name", () => {
    // "greater-than-or-equal-to" ends with "greater-than-or-equal" is FALSE as a substring,
    // but we want to confirm the endsWith check is exact at the suffix boundary
    expect(isDateProperty("field~greater-than-or-equal-to", "string")).toBe(false);
  });
});

describe("isRelationProperty", () => {
  it("returns false for a direct attribute property", () => {
    expect(isRelationProperty("name~prefix-match")).toBe(false);
  });

  it("returns true for a relation-traversal property", () => {
    expect(isRelationProperty("customer.name~prefix-match")).toBe(true);
  });

  it("returns false for a range-pair property (dot is part of the .~ operator, not a relation)", () => {
    expect(isRelationProperty("amount.~from")).toBe(false);
  });

  it("returns false for a plain name with no operator or relation", () => {
    expect(isRelationProperty("status")).toBe(false);
  });
});

describe("SEARCH_TYPE_LABELS", () => {
  it("maps all documented blueprint:search-param operator names (no -to suffix)", () => {
    expect(SEARCH_TYPE_LABELS["greater-than"]).toBe("after");
    expect(SEARCH_TYPE_LABELS["less-than"]).toBe("before");
    expect(SEARCH_TYPE_LABELS["greater-than-or-equal"]).toBe("from");
    expect(SEARCH_TYPE_LABELS["less-than-or-equal"]).toBe("until");
    expect(SEARCH_TYPE_LABELS["prefix-match"]).toBe("prefix");
    expect(SEARCH_TYPE_LABELS["exact-match"]).toBe("exact");
    expect(SEARCH_TYPE_LABELS["full-text"]).toBe("contains");
  });

  it("does NOT contain the wrong -to suffix variants", () => {
    expect(SEARCH_TYPE_LABELS["greater-than-or-equal-to"]).toBeUndefined();
    expect(SEARCH_TYPE_LABELS["less-than-or-equal-to"]).toBeUndefined();
  });
});

describe("IMPLICIT_OPS", () => {
  it("suppresses prefix-match and exact-match labels", () => {
    expect(IMPLICIT_OPS.has("prefix-match")).toBe(true);
    expect(IMPLICIT_OPS.has("exact-match")).toBe(true);
  });

  it("does not suppress bare prefix (platform emits prefix-match, not prefix)", () => {
    expect(IMPLICIT_OPS.has("prefix")).toBe(false);
  });

  it("does not suppress greater-than, full-text, or range operators", () => {
    expect(IMPLICIT_OPS.has("greater-than")).toBe(false);
    expect(IMPLICIT_OPS.has("full-text")).toBe(false);
    expect(IMPLICIT_OPS.has("~from")).toBe(false);
  });
});
