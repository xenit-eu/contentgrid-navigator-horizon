import { describe, expect, it } from "vitest";
import { formatCount } from "./format-count";

describe("formatCount", () => {
  it("shows an exact count as is", () => {
    expect(formatCount({ count: 412, isEstimated: false })).toBe("412");
  });

  it("groups thousands with a thin no-break space", () => {
    expect(formatCount({ count: 1284, isEstimated: false })).toBe("1 284");
    expect(formatCount({ count: 1234567, isEstimated: false })).toBe("1 234 567");
  });

  it("prefixes an estimate with a tilde", () => {
    expect(formatCount({ count: 1204, isEstimated: true })).toBe("~1 204");
  });

  it("marks an estimate with a word when asked to", () => {
    expect(formatCount({ count: 1204, isEstimated: true }, { estimate: "word" })).toBe(
      "about 1\u202f204",
    );
    expect(formatCount({ count: 1204, isEstimated: false }, { estimate: "word" })).toBe(
      "1\u202f204",
    );
  });

  it("shows zero", () => {
    expect(formatCount({ count: 0, isEstimated: false })).toBe("0");
  });

  it("returns undefined when there is no usable count", () => {
    expect(formatCount(undefined)).toBeUndefined();
    expect(formatCount(null)).toBeUndefined();
    expect(formatCount({ count: Number.NaN, isEstimated: false })).toBeUndefined();
  });
});
