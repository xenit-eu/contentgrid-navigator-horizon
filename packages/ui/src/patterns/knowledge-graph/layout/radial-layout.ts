/**
 * Deterministic "focus + neighbours + trail" radial layout for the knowledge graph (research R3).
 * Pure: no React, no React Flow — unit-testable in isolation.
 *
 * - The focus node sits at the centre.
 * - Ring 1: every node adjacent to the focus, in input edge order (the consumer groups edges per
 *   relation), with the previous trail node pinned at the left (angle π).
 * - Ring 2: nodes adjacent to the previous trail node that aren't on ring 1, fanned out in a
 *   sector centred behind the previous node (around angle π), on a larger concentric circle.
 * - Older trail nodes continue further left on a straight line (the "trail line").
 * - Anything else is placed on an outer ring.
 *
 * Spacing is derived from `nodeSpacing` so neighbouring centres are never closer than it.
 * When `previous` positions are given, the whole layout is translated so the focus node keeps
 * the position it had before — the graph grows around the item the user just clicked instead of
 * jumping.
 */

export interface LayoutPoint {
  readonly x: number;
  readonly y: number;
}

export interface RadialLayoutInput {
  readonly nodeIds: readonly string[];
  readonly edges: readonly { readonly source: string; readonly target: string }[];
  readonly focusNodeId: string;
  readonly trailNodeIds: readonly string[];
  readonly previous?: Readonly<Record<string, LayoutPoint>>;
  /** Minimum distance between two node centres (default 220). */
  readonly nodeSpacing?: number;
}

export const DEFAULT_NODE_SPACING = 220;
const MIN_RING_RADIUS = 280;

function neighboursOf(
  id: string,
  edges: RadialLayoutInput["edges"],
  exists: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  for (const edge of edges) {
    const other = edge.source === id ? edge.target : edge.target === id ? edge.source : undefined;
    if (other !== undefined && !seen.has(other) && exists.has(other)) {
      seen.add(other);
      out.push(other);
    }
  }
  return out;
}

/** Radius so that `count` nodes spaced `spacing` apart fit on a full circle. */
function ringRadius(count: number, spacing: number, min: number): number {
  if (count <= 1) return min;
  return Math.max(min, spacing / 2 / Math.sin(Math.PI / count));
}

const polar = (radius: number, angle: number): LayoutPoint => ({
  x: Math.round(radius * Math.cos(angle)),
  y: Math.round(radius * Math.sin(angle)),
});

export function radialLayout(input: RadialLayoutInput): Record<string, LayoutPoint> {
  const spacing = input.nodeSpacing ?? DEFAULT_NODE_SPACING;
  const exists = new Set(input.nodeIds);
  const positions: Record<string, LayoutPoint> = {};
  const placed = new Set<string>();
  const place = (id: string, point: LayoutPoint) => {
    positions[id] = point;
    placed.add(id);
  };

  if (!exists.has(input.focusNodeId)) return positions;
  place(input.focusNodeId, { x: 0, y: 0 });

  const focusIndex = input.trailNodeIds.lastIndexOf(input.focusNodeId);
  const previousId =
    focusIndex > 0 && exists.has(input.trailNodeIds[focusIndex - 1]!)
      ? input.trailNodeIds[focusIndex - 1]!
      : undefined;
  const olderTrail = (focusIndex > 1 ? input.trailNodeIds.slice(0, focusIndex - 1) : [])
    .filter((id) => exists.has(id))
    .reverse(); // nearest first

  // Ring 1 — previous trail node first (pinned at angle π), then the focus's neighbours.
  const ring1 = neighboursOf(input.focusNodeId, input.edges, exists).filter(
    (id) => id !== previousId,
  );
  if (previousId) ring1.unshift(previousId);
  const r1 = ringRadius(ring1.length, spacing, MIN_RING_RADIUS);
  ring1.forEach((id, i) => {
    place(id, polar(r1, Math.PI + (2 * Math.PI * i) / ring1.length));
  });

  // Ring 2 — the previous node's own neighbours, fanned out in a sector behind it.
  let outer = r1;
  if (previousId) {
    const olderSet = new Set(olderTrail);
    const ring2 = neighboursOf(previousId, input.edges, exists).filter(
      (id) => !placed.has(id) && !olderSet.has(id),
    );
    if (ring2.length > 0) {
      const r2 = r1 + spacing;
      const step = spacing / r2; // radians between neighbours on ring 2
      // Leave the exact π slot free for the trail line when older trail nodes exist.
      const slots = olderTrail.length > 0 ? ring2.length + 1 : ring2.length;
      const start = Math.PI - (step * (slots - 1)) / 2;
      const skip = olderTrail.length > 0 ? Math.floor(slots / 2) : -1;
      let slot = 0;
      for (const id of ring2) {
        if (slot === skip) slot++;
        place(id, polar(r2, start + step * slot));
        slot++;
      }
      outer = r2;
    }
  }

  // Trail line — older trail nodes further left, one step apart.
  olderTrail.forEach((id, i) => {
    if (!placed.has(id)) place(id, { x: -Math.round(outer + spacing * (i + 1)), y: 0 });
  });

  // Anything left: an outer ring.
  const rest = input.nodeIds.filter((id) => !placed.has(id));
  if (rest.length > 0) {
    const trailExtent = olderTrail.length > 0 ? outer + spacing * olderTrail.length : outer;
    const r3 = Math.max(trailExtent + spacing, ringRadius(rest.length, spacing, MIN_RING_RADIUS));
    rest.forEach((id, i) => place(id, polar(r3, -Math.PI / 2 + (2 * Math.PI * i) / rest.length)));
  }

  // Keep the focus where it was before (if it was visible), so the graph grows around it.
  const anchor = input.previous?.[input.focusNodeId];
  if (anchor) {
    for (const id of Object.keys(positions)) {
      const p = positions[id]!;
      positions[id] = { x: p.x + anchor.x, y: p.y + anchor.y };
    }
  }
  return positions;
}
