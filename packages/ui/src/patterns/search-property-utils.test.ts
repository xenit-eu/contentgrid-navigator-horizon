import { describe, expect, it } from "vitest";
import {
  IMPLICIT_OPS,
  SEARCH_TYPE_LABELS,
  type SearchProperty,
  formatFieldLabel,
  formatWords,
  isDateProperty,
  parseName,
} from "./search-property-utils";

describe("parseName", () => {
  it("returns the full name as base with null op when there is no tilde", () => {
    expect(parseName("status")).toEqual({ base: "status", op: null });
  });

  it("splits on the tilde for field~op format", () => {
    expect(parseName("created_at~gt")).toEqual({
      base: "created_at",
      op: "gt",
    });
  });

  it("handles the prefix operator suffix", () => {
    expect(parseName("number~prefix")).toEqual({ base: "number", op: "prefix" });
  });

  it("handles the full-text operator suffix", () => {
    expect(parseName("notes~fts")).toEqual({ base: "notes", op: "fts" });
  });

  it("handles the lte operator suffix", () => {
    expect(parseName("due~lte")).toEqual({ base: "due", op: "lte" });
  });

  it("handles the gte operator suffix", () => {
    expect(parseName("due~gte")).toEqual({ base: "due", op: "gte" });
  });

  it("handles the datetime after/before suffixes", () => {
    expect(parseName("datetime~after")).toEqual({ base: "datetime", op: "after" });
    expect(parseName("datetime~before")).toEqual({ base: "datetime", op: "before" });
  });

  it("keeps a relation-traversal dotted base intact", () => {
    // "products.product_name~prefix": the "." is part of the base, only "~" splits off the op
    expect(parseName("products.product_name~prefix")).toEqual({
      base: "products.product_name",
      op: "prefix",
    });
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

  it("does not produce a leading/trailing space for a leading separator", () => {
    expect(formatWords("_sort")).toBe("Sort");
  });
});

describe("formatFieldLabel", () => {
  it("returns prompt when provided", () => {
    const prop: SearchProperty = {
      name: "invoice_date~gt",
      prompt: "Invoice date",
      type: "datetime",
    };
    expect(formatFieldLabel(prop)).toBe("Invoice date");
  });

  it("derives label from base field name when prompt is absent", () => {
    const prop: SearchProperty = { name: "invoice_date~gt", type: "datetime" };
    expect(formatFieldLabel(prop)).toBe("Invoice Date");
  });

  it("strips the operator suffix before formatting", () => {
    const prop: SearchProperty = { name: "total~gte", type: "number" };
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

  it("returns true when name ends with ~after", () => {
    expect(isDateProperty("due~after", "text")).toBe(true);
  });

  it("returns true when name ends with ~before", () => {
    expect(isDateProperty("due~before", "text")).toBe(true);
  });

  it("returns false for plain text property with no date suffix", () => {
    expect(isDateProperty("status", "text")).toBe(false);
  });

  it("returns false for numeric range suffixes — ~gt/~gte/~lt/~lte are also used for plain numbers", () => {
    // e.g. "long~gt" in the platform's own all-attribute fixture is type "number", not a date
    expect(isDateProperty("long~gt", "number")).toBe(false);
    expect(isDateProperty("long~gte", "number")).toBe(false);
    expect(isDateProperty("long~lt", "number")).toBe(false);
    expect(isDateProperty("long~lte", "number")).toBe(false);
  });

  it("name-based detection overrides a non-date type: ~after/~before are still dates even when type is 'text'", () => {
    // range props can arrive from the HAL platform typed loosely even when their value is
    // always a date; the suffix is the authoritative signal for ~after/~before specifically
    expect(isDateProperty("amount~after", "text")).toBe(true);
    expect(isDateProperty("amount~before", "text")).toBe(true);
  });

  it("does not match a partial suffix embedded in a longer name", () => {
    expect(isDateProperty("field~afterward", "text")).toBe(false);
  });
});

describe("SEARCH_TYPE_LABELS", () => {
  it("maps the platform's actual short-suffix operator vocabulary", () => {
    expect(SEARCH_TYPE_LABELS["gt"]).toBe("after");
    expect(SEARCH_TYPE_LABELS["lt"]).toBe("before");
    expect(SEARCH_TYPE_LABELS["gte"]).toBe("from");
    expect(SEARCH_TYPE_LABELS["lte"]).toBe("until");
    expect(SEARCH_TYPE_LABELS["after"]).toBe("after");
    expect(SEARCH_TYPE_LABELS["before"]).toBe("before");
    expect(SEARCH_TYPE_LABELS["from"]).toBe("from");
    expect(SEARCH_TYPE_LABELS["until"]).toBe("until");
    expect(SEARCH_TYPE_LABELS["prefix"]).toBe("prefix");
    expect(SEARCH_TYPE_LABELS["fts"]).toBe("contains");
  });

  it("does NOT contain the long-form blueprint:search-param type vocabulary", () => {
    // those long-form strings ("greater-than", "prefix-match", ...) are the values of the
    // `type` field on `blueprint:search-param`, never a `name` suffix
    expect(SEARCH_TYPE_LABELS["greater-than"]).toBeUndefined();
    expect(SEARCH_TYPE_LABELS["prefix-match"]).toBeUndefined();
    expect(SEARCH_TYPE_LABELS["exact-match"]).toBeUndefined();
    expect(SEARCH_TYPE_LABELS["full-text"]).toBeUndefined();
  });
});

describe("IMPLICIT_OPS", () => {
  it("suppresses the prefix operator", () => {
    expect(IMPLICIT_OPS.has("prefix")).toBe(true);
  });

  it("does not suppress greater-than/less-than/full-text/from/until operators", () => {
    expect(IMPLICIT_OPS.has("gt")).toBe(false);
    expect(IMPLICIT_OPS.has("fts")).toBe(false);
    expect(IMPLICIT_OPS.has("from")).toBe(false);
    expect(IMPLICIT_OPS.has("until")).toBe(false);
  });
});
