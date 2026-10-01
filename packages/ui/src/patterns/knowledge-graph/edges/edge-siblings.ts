/**
 * Parallel-edge bookkeeping: for every edge, its index among the edges connecting the same
 * unordered node pair and the size of that group. Used to bend parallel edges apart and to stack
 * multiple self-loops (research R4).
 */
export interface EdgeSiblingInfo {
  readonly index: number;
  readonly count: number;
}

export function computeEdgeSiblings(
  edges: readonly { readonly id: string; readonly source: string; readonly target: string }[],
): Map<string, EdgeSiblingInfo> {
  const groups = new Map<string, string[]>();
  for (const edge of edges) {
    const key =
      edge.source < edge.target ? `${edge.source}|${edge.target}` : `${edge.target}|${edge.source}`;
    const group = groups.get(key) ?? [];
    group.push(edge.id);
    groups.set(key, group);
  }
  const result = new Map<string, EdgeSiblingInfo>();
  for (const group of groups.values()) {
    group.forEach((id, index) => result.set(id, { index, count: group.length }));
  }
  return result;
}

/** Perpendicular offset (px) of sibling `index` of `count`: 0 for a single edge, symmetric otherwise. */
export function siblingOffset(info: EdgeSiblingInfo | undefined, gap = 36): number {
  if (!info || info.count <= 1) return 0;
  return (info.index - (info.count - 1) / 2) * gap;
}
