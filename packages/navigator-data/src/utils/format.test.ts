import { describe, expect, it } from "vitest";
import { convertToString, formatWords, titleCase } from "./format";

describe("formatWords", () => {
  it("capitalises a plain lowercase word", () => {
    expect(formatWords("draft")).toBe("Draft");
  });

  it("replaces underscores with spaces and capitalises each word", () => {
    expect(formatWords("in_progress")).toBe("In Progress");
  });

  it("replaces dots with spaces and capitalises each word", () => {
    expect(formatWords("some.field")).toBe("Some Field");
  });

  it("replaces hyphens with spaces and capitalises each word", () => {
    expect(formatWords("my-value")).toBe("My Value");
  });

  it("uppercases known acronyms — id", () => {
    expect(formatWords("customer_id")).toBe("Customer ID");
  });

  it("uppercases known acronyms — url", () => {
    expect(formatWords("redirect_url")).toBe("Redirect URL");
  });

  it("uppercases known acronyms — api", () => {
    expect(formatWords("api_key")).toBe("API Key");
  });

  it("leaves already-capitalised server-provided labels unchanged (e.g. 'In Review')", () => {
    // The function still capitalises each word, so "In Review" → "In Review" (idempotent)
    expect(formatWords("In Review")).toBe("In Review");
  });
});

describe("titleCase", () => {
  it("capitalises the first letter of each word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });
  it("handles already-capitalised input", () => {
    expect(titleCase("Invoice")).toBe("Invoice");
  });
});

describe("convertToString", () => {
  it("returns empty string for null", () => expect(convertToString(null)).toBe(""));
  it("returns empty string for undefined", () => expect(convertToString(undefined)).toBe(""));
  it("returns string values unchanged", () => expect(convertToString("hello")).toBe("hello"));
  it("converts numbers", () => expect(convertToString(42)).toBe("42"));
  it("converts booleans", () => {
    expect(convertToString(true)).toBe("true");
    expect(convertToString(false)).toBe("false");
  });
  it("converts bigint", () => expect(convertToString(9007199254740993n)).toBe("9007199254740993"));
  it("JSON-stringifies plain objects", () => {
    expect(convertToString({ a: 1 })).toBe('{"a":1}');
  });
  it("JSON-stringifies arrays", () => {
    expect(convertToString([1, 2, 3])).toBe("[1,2,3]");
  });
  it("returns empty string for circular references (JSON.stringify throws)", () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(convertToString(circ)).toBe("");
  });
  it("returns empty string for unknown types like symbol", () => {
    expect(convertToString(Symbol("x"))).toBe("");
  });
});
