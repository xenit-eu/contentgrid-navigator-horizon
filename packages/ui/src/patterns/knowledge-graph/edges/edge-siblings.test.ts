import { describe, expect, it } from "vitest";
import { computeEdgeSiblings, siblingOffset } from "./edge-siblings";

describe("computeEdgeSiblings", () => {
  it("groups edges by unordered node pair", () => {
    const info = computeEdgeSiblings([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "a" },
      { id: "e3", source: "a", target: "c" },
      { id: "loop1", source: "a", target: "a" },
      { id: "loop2", source: "a", target: "a" },
    ]);
    expect(info.get("e1")).toEqual({ index: 0, count: 2 });
    expect(info.get("e2")).toEqual({ index: 1, count: 2 });
    expect(info.get("e3")).toEqual({ index: 0, count: 1 });
    expect(info.get("loop2")).toEqual({ index: 1, count: 2 });
  });
});

describe("siblingOffset", () => {
  it("is zero for a single edge and symmetric for parallel ones", () => {
    expect(siblingOffset({ index: 0, count: 1 })).toBe(0);
    expect(siblingOffset({ index: 0, count: 2 }, 36)).toBe(-18);
    expect(siblingOffset({ index: 1, count: 2 }, 36)).toBe(18);
    expect(siblingOffset({ index: 1, count: 3 }, 36)).toBe(0);
  });
});
