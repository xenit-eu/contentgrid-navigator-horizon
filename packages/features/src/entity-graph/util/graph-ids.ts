/**
 * The one place graph node/edge ids are computed (research R5). Every other file in the
 * entity-graph feature derives ids through these helpers, so the node-identity rule can change in
 * a single place.
 */

/** Identifies an item well enough to fetch it (via its profile) and key it in the graph. */
export interface GraphItemRef {
  /** `ProfileEntity.name` of the item's type. */
  readonly entityName: string;
  /** `EntityItem.id` — never parsed from an href. */
  readonly id: string;
}

/**
 * Node id of an item. The spec (FR-002) guarantees ids are unique across entity types, so the id
 * alone is the key — one item is one node however many paths lead to it.
 */
export function graphNodeId(ref: GraphItemRef): string {
  return ref.id;
}

/** Node id of the "+ N more" placeholder for one to-many relation of one owner item. */
export function overflowNodeId(owner: GraphItemRef, relationName: string): string {
  return `overflow:${graphNodeId(owner)}:${relationName}`;
}

/** Node id of the placeholder for a to-one target the current user cannot read. */
export function unavailableNodeId(owner: GraphItemRef, relationName: string): string {
  return `unavailable:${graphNodeId(owner)}:${relationName}`;
}

/** Edge id for one relation link (or the link to an overflow/unavailable placeholder). */
export function graphEdgeId(sourceNodeId: string, relationName: string, targetNodeId: string) {
  return `${sourceNodeId}->${relationName}->${targetNodeId}`;
}

/** Key of one relation of one owner — used to store targets pinned from an overflow list. */
export type ExpansionKey = `${string}::${string}`;

export function expansionKey(ownerNodeId: string, relationName: string): ExpansionKey {
  return `${ownerNodeId}::${relationName}`;
}

export function sameRef(a: GraphItemRef, b: GraphItemRef): boolean {
  return a.entityName === b.entityName && a.id === b.id;
}
