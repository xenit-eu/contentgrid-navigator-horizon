/** Pure geometry for the relation edge (unit-tested separately from React Flow). */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  /** Centre. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where the ray from the box centre towards `toward` leaves the box (plus a small margin). */
export function borderPoint(box: Box, toward: Point, margin = 4): Point {
  const dx = toward.x - box.x;
  const dy = toward.y - box.y;
  if (dx === 0 && dy === 0) return { x: box.x, y: box.y };
  const halfW = box.width / 2 + margin;
  const halfH = box.height / 2 + margin;
  const t = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );
  return { x: box.x + dx * t, y: box.y + dy * t };
}

export interface EdgePath {
  readonly path: string;
  readonly labelX: number;
  readonly labelY: number;
}

/**
 * Straight edge when `offset` is 0, otherwise a quadratic curve bent `offset` px perpendicular to
 * the centre line (parallel edges between the same pair).
 */
export function linkPath(source: Box, target: Box, offset: number): EdgePath {
  const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal; its sign is fixed by a canonical ordering so A→B and B→A bend to opposite sides
  // consistently with their sibling offsets.
  const nx = -dy / length;
  const ny = dx / length;
  const control = { x: mid.x + nx * offset * 2, y: mid.y + ny * offset * 2 };

  const start = borderPoint(source, offset === 0 ? target : control);
  const end = borderPoint(target, offset === 0 ? source : control);

  if (offset === 0) {
    return { path: `M ${start.x},${start.y} L ${end.x},${end.y}`, labelX: mid.x, labelY: mid.y };
  }
  return {
    path: `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`,
    // Point on the quadratic curve at t = 0.5.
    labelX: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    labelY: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };
}

/** A loop above the node for a self-relation; `index` stacks multiple self-loops. */
export function selfLoopPath(box: Box, index: number): EdgePath {
  const top = box.y - box.height / 2;
  const spread = box.width * 0.3;
  const height = 56 + index * 28;
  const x1 = box.x - spread / 2;
  const x2 = box.x + spread / 2;
  return {
    path: `M ${x1},${top} C ${x1 - 30},${top - height} ${x2 + 30},${top - height} ${x2},${top}`,
    labelX: box.x,
    labelY: top - height * 0.75,
  };
}
