import { describe, expect, it } from "vitest";
import {
  asBoolean,
  asDateOrString,
  asNumberOrString,
  asString,
  asStringArray,
} from "./narrow-field-value";

describe("narrow-field-value", () => {
  const date = new Date("2026-09-24T14:30:00Z");

  it("asString keeps strings only", () => {
    expect(asString("acme")).toBe("acme");
    expect(asString("")).toBe("");
    expect(asString(42)).toBeUndefined();
    expect(asString(undefined)).toBeUndefined();
  });

  it("asNumberOrString keeps numbers and strings", () => {
    expect(asNumberOrString(0)).toBe(0);
    expect(asNumberOrString("42")).toBe("42");
    expect(asNumberOrString(false)).toBeUndefined();
  });

  it("asBoolean keeps booleans only, including false", () => {
    expect(asBoolean(false)).toBe(false);
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean("true")).toBeUndefined();
  });

  it("asDateOrString keeps dates and strings", () => {
    expect(asDateOrString(date)).toBe(date);
    expect(asDateOrString("2026-09-24")).toBe("2026-09-24");
    expect(asDateOrString(42)).toBeUndefined();
  });

  it("asStringArray keeps the string entries of an array", () => {
    expect(asStringArray(["a", "b"])).toEqual(["a", "b"]);
    expect(asStringArray("a")).toBeUndefined();
    expect(asStringArray(undefined)).toBeUndefined();
  });
});
