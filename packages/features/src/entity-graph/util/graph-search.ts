import type { TrailEntry } from "./graph-state";

/**
 * URL search-param shape of the graph route: the trail after the root, as plain identifiers
 * (entity name + item id + the relation it was reached through). Never URLs.
 */
export interface GraphTrailParam {
  readonly e: string;
  readonly id: string;
  readonly via?: string;
}

export interface GraphSearchState {
  readonly trail?: readonly GraphTrailParam[];
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * `validateSearch` for the graph route. Keeps only well-formed trail entries (non-empty string
 * `e` and `id`, optional non-empty string `via`), drops anything else, never throws. An empty
 * trail is omitted entirely so the URL stays clean.
 */
export function graphSearchValidator(search: Record<string, unknown>): GraphSearchState {
  const raw = search.trail;
  if (!Array.isArray(raw)) return {};
  const trail: GraphTrailParam[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const { e, id, via } = entry as Record<string, unknown>;
    if (!isNonEmptyString(e) || !isNonEmptyString(id)) continue;
    trail.push(isNonEmptyString(via) ? { e, id, via } : { e, id });
  }
  return trail.length > 0 ? { trail } : {};
}

/** Trail after the root → search params (`undefined` when empty). */
export function trailToSearch(
  trailAfterRoot: readonly TrailEntry[],
): readonly GraphTrailParam[] | undefined {
  if (trailAfterRoot.length === 0) return undefined;
  return trailAfterRoot.map((t) =>
    t.via ? { e: t.entityName, id: t.id, via: t.via } : { e: t.entityName, id: t.id },
  );
}

/** Search params → trail after the root. */
export function searchToTrail(params: readonly GraphTrailParam[] | undefined): TrailEntry[] {
  return (params ?? []).map((p) =>
    p.via ? { entityName: p.e, id: p.id, via: p.via } : { entityName: p.e, id: p.id },
  );
}
