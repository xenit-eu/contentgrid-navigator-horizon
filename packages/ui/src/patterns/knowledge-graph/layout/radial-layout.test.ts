import { describe, expect, it } from "vitest";
import { DEFAULT_NODE_SPACING, type LayoutPoint, radialLayout } from "./radial-layout";

const distance = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y);

function star(center: string, count: number, prefix: string) {
  const ids = Array.from({ length: count }, (_, i) => `${prefix}${i}`);
  return { ids, edges: ids.map((id) => ({ source: center, target: id })) };
}

function minPairDistance(positions: Record<string, LayoutPoint>) {
  const pts = Object.values(positions);
  let min = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) min = Math.min(min, distance(pts[i]!, pts[j]!));
  return min;
}

describe("radialLayout", () => {
  it("puts the focus at the centre and its neighbours on a ring", () => {
    const { ids, edges } = star("f", 5, "n");
    const pos = radialLayout({
      nodeIds: ["f", ...ids],
      edges,
      focusNodeId: "f",
      trailNodeIds: ["f"],
    });
    expect(pos.f).toEqual({ x: 0, y: 0 });
    // Coordinates are rounded to whole pixels, so radii agree to within 1px.
    const radii = ids.map((id) => distance(pos[id]!, { x: 0, y: 0 }));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThanOrEqual(1);
  });

  it("is deterministic", () => {
    const { ids, edges } = star("f", 12, "n");
    const input = { nodeIds: ["f", ...ids], edges, focusNodeId: "f", trailNodeIds: ["f"] };
    expect(radialLayout(input)).toEqual(radialLayout(input));
  });

  it("pins the previous trail node to the left and fans its neighbours out behind it", () => {
    const nodeIds = ["root", "prev", "f", "a", "b", "p1", "p2", "p3"];
    const edges = [
      { source: "root", target: "prev" },
      { source: "prev", target: "f" },
      { source: "f", target: "a" },
      { source: "f", target: "b" },
      { source: "prev", target: "p1" },
      { source: "prev", target: "p2" },
      { source: "prev", target: "p3" },
    ];
    const pos = radialLayout({
      nodeIds,
      edges,
      focusNodeId: "f",
      trailNodeIds: ["root", "prev", "f"],
    });
    expect(pos.prev!.y).toBe(0);
    expect(pos.prev!.x).toBeLessThan(0);
    for (const id of ["p1", "p2", "p3"]) {
      expect(distance(pos[id]!, { x: 0, y: 0 })).toBeGreaterThan(
        distance(pos.prev!, { x: 0, y: 0 }),
      );
      expect(pos[id]!.x).toBeLessThan(0);
    }
    // Older trail node continues the trail line further left.
    expect(pos.root!.y).toBe(0);
    expect(pos.root!.x).toBeLessThan(Math.min(pos.p1!.x, pos.p2!.x, pos.p3!.x));
  });

  it("keeps the focus at its previous position when it was visible before", () => {
    const { ids, edges } = star("f", 3, "n");
    const pos = radialLayout({
      nodeIds: ["f", ...ids],
      edges,
      focusNodeId: "f",
      trailNodeIds: ["f"],
      previous: { f: { x: 400, y: -120 } },
    });
    expect(pos.f).toEqual({ x: 400, y: -120 });
  });

  it("never places two of 50 nodes closer than the node spacing", () => {
    const focusStar = star("f", 30, "a");
    const prevStar = star("prev", 17, "b");
    const nodeIds = ["root", "prev", "f", ...focusStar.ids, ...prevStar.ids];
    expect(nodeIds).toHaveLength(50);
    const edges = [
      { source: "root", target: "prev" },
      { source: "prev", target: "f" },
      ...focusStar.edges,
      ...prevStar.edges,
    ];
    const pos = radialLayout({
      nodeIds,
      edges,
      focusNodeId: "f",
      trailNodeIds: ["root", "prev", "f"],
    });
    expect(Object.keys(pos)).toHaveLength(50);
    expect(minPairDistance(pos)).toBeGreaterThanOrEqual(DEFAULT_NODE_SPACING - 2);
  });

  it("places unconnected nodes on an outer ring without collisions", () => {
    const pos = radialLayout({
      nodeIds: ["f", "x", "y", "z"],
      edges: [],
      focusNodeId: "f",
      trailNodeIds: ["f"],
    });
    expect(Object.keys(pos).sort()).toEqual(["f", "x", "y", "z"]);
    expect(minPairDistance(pos)).toBeGreaterThanOrEqual(DEFAULT_NODE_SPACING - 2);
  });

  it("ignores self-loops and duplicate edges when finding neighbours", () => {
    const pos = radialLayout({
      nodeIds: ["f", "a"],
      edges: [
        { source: "f", target: "f" },
        { source: "f", target: "a" },
        { source: "f", target: "a" },
      ],
      focusNodeId: "f",
      trailNodeIds: ["f"],
    });
    expect(Object.keys(pos)).toHaveLength(2);
  });

  it("places attached nodes just beyond their owner, away from the focus", () => {
    const { ids, edges } = star("f", 4, "n");
    const files = ["file-a", "file-b"];
    const positions = radialLayout({
      nodeIds: ["f", ...ids, ...files],
      edges: [...edges, ...files.map((id) => ({ source: "n1", target: id }))],
      focusNodeId: "f",
      trailNodeIds: ["f"],
      attachments: { "file-a": "n1", "file-b": "n1" },
    });
    // The ring is laid out as if the files weren't there.
    expect(positions).toMatchObject(
      radialLayout({ nodeIds: ["f", ...ids], edges, focusNodeId: "f", trailNodeIds: ["f"] }),
    );
    const owner = positions.n1!;
    for (const id of files) {
      const p = positions[id]!;
      expect(distance(p, owner)).toBeLessThan(DEFAULT_NODE_SPACING);
      // Further from the focus than the owner: on its outer side.
      expect(distance(p, positions.f!)).toBeGreaterThan(distance(owner, positions.f!));
    }
    expect(distance(positions["file-a"]!, positions["file-b"]!)).toBeGreaterThan(40);
  });
});
