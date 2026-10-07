import { describe, expect, it } from "vitest";
import { classifySearchInput, normaliseNumberInput } from "./classify-search-input";

describe("classifySearchInput", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["12", "integer"],
    [" -3 ", "integer"],
    ["12.5", "decimal"],
    ["12,5", "decimal"],
    [".5", "decimal"],
    ["-0.25", "decimal"],
    ["abc", "text"],
    ["12abc", "text"],
    ["1.2.3", "text"],
    ["12.", "text"],
  ] as const)("%j → %s", (input, expected) => {
    expect(classifySearchInput(input)).toBe(expected);
  });
});

describe("normaliseNumberInput", () => {
  it("trims and replaces a decimal comma", () => {
    expect(normaliseNumberInput(" 12,5 ")).toBe("12.5");
    expect(normaliseNumberInput("42")).toBe("42");
  });
});
