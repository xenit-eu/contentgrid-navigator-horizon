import { describe, expect, it } from "vitest";
import { cn, formatCellValue } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resolves conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatCellValue", () => {
  it("returns the placeholder for null", () => {
    expect(formatCellValue(null)).toBe("—");
  });

  it("returns the placeholder for undefined", () => {
    expect(formatCellValue(undefined)).toBe("—");
  });

  it("accepts a custom placeholder", () => {
    expect(formatCellValue(null, "n/a")).toBe("n/a");
  });

  it("stringifies primitive strings", () => {
    expect(formatCellValue("hello")).toBe("hello");
  });

  it("stringifies numbers", () => {
    expect(formatCellValue(42)).toBe("42");
  });

  it("stringifies booleans", () => {
    expect(formatCellValue(true)).toBe("true");
  });

  it("renders objects as JSON instead of [object Object]", () => {
    expect(formatCellValue({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });

  it("renders arrays as JSON", () => {
    expect(formatCellValue([1, 2, 3])).toBe("[1,2,3]");
  });

  it("falls back to the placeholder when JSON.stringify throws (circular ref)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatCellValue(circular)).toBe("—");
  });
});
