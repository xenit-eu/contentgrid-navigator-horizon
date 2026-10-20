import { describe, expect, it } from "vitest";
import { borderPoint, linkPath, selfLoopPath } from "./edge-geometry";

const a = { x: 0, y: 0, width: 100, height: 40 };
const b = { x: 300, y: 0, width: 100, height: 40 };

describe("edge geometry", () => {
  it("finds the border point towards another point", () => {
    expect(borderPoint(a, { x: 300, y: 0 }, 0)).toEqual({ x: 50, y: 0 });
    expect(borderPoint(a, { x: 0, y: 300 }, 0)).toEqual({ x: 0, y: 20 });
  });

  it("draws a straight line between borders for a single edge", () => {
    const p = linkPath(a, b, 0);
    expect(p.path).toBe("M 54,0 L 246,0");
    expect([p.labelX, p.labelY]).toEqual([150, 0]);
  });

  it("bends parallel edges to opposite sides", () => {
    const up = linkPath(a, b, -18);
    const down = linkPath(a, b, 18);
    expect(up.path).toContain(" Q ");
    expect(Math.sign(up.labelY)).toBe(-Math.sign(down.labelY));
  });

  it("draws a self-loop above the node and stacks further loops higher", () => {
    const first = selfLoopPath(a, 0);
    const second = selfLoopPath(a, 1);
    expect(first.labelY).toBeLessThan(-20);
    expect(second.labelY).toBeLessThan(first.labelY);
  });
});
