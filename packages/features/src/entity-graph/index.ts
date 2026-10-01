// Public API of the entity-graph feature (spec 007 — knowledge graph).
export { EntityGraphView } from "./views/entity-graph-view";
export type { EntityGraphViewProps } from "./views/entity-graph-view";
export type { TrailEntry } from "./util/graph-state";
export { graphSearchValidator, searchToTrail, trailToSearch } from "./util/graph-search";
export type { GraphSearchState, GraphTrailParam } from "./util/graph-search";
