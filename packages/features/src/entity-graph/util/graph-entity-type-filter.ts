import type { GraphModel } from "./build-graph-model";

/** One entity type drawn in the graph, for the type legend / filter. */
export interface GraphEntityTypeModel {
  readonly entityName: string;
  readonly title: string;
  readonly color: string | undefined;
  readonly icon: string | undefined;
  /** Item nodes of this type in the unfiltered graph. */
  readonly count: number;
}

/** The entity types of the graph's item nodes, in order of first appearance. */
export function graphEntityTypes(model: GraphModel): GraphEntityTypeModel[] {
  const types = new Map<string, GraphEntityTypeModel>();
  for (const node of model.nodes) {
    if (node.kind !== "item") continue;
    const name = node.ref.entityName;
    const existing = types.get(name);
    types.set(name, {
      entityName: name,
      title: existing?.title ?? node.entityTitle,
      color: existing?.color ?? node.color,
      icon: existing?.icon ?? node.icon,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...types.values()];
}

/**
 * Leaves out the relation targets (item nodes, and "+ N more" nodes) of the hidden entity types,
 * and every edge to them. The focus and trail items always stay: they are the path being explored.
 */
export function filterGraphModel(model: GraphModel, hidden: ReadonlySet<string>): GraphModel {
  if (hidden.size === 0) return model;
  const nodes = model.nodes.filter((node) =>
    node.kind === "item"
      ? node.role !== "target" || !hidden.has(node.ref.entityName)
      : node.targetEntityName === undefined || !hidden.has(node.targetEntityName),
  );
  const kept = new Set(nodes.map((node) => node.id));
  const edges = model.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target));
  return { ...model, nodes, edges };
}
