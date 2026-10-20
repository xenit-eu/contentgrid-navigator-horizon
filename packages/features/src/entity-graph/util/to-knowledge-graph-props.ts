import type { GraphEdgeModel, GraphModel, GraphNodeModel } from "./build-graph-model";
import { graphNodeId } from "./graph-ids";
import type { GraphSelection, GraphState } from "./graph-state";

/*
 * Plain-value view models handed to the `KnowledgeGraph` ui pattern. Declared here (structurally
 * identical to the pattern's own prop types) because `util/` must not import `@contentgrid/ui`;
 * TypeScript's structural typing makes them directly assignable.
 */

export interface GraphViewNode {
  readonly id: string;
  readonly kind: "item" | "overflow";
  readonly label: string;
  readonly sublabel?: string;
  readonly color?: string;
  readonly icon?: string;
  readonly emphasis: "focus" | "previous-focus" | "trail" | "normal";
  readonly muted?: boolean;
  readonly estimated?: boolean;
  readonly ariaLabel: string;
}

export interface GraphViewEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label: string;
  readonly emphasis: "trail" | "normal";
  readonly ariaLabel: string;
}

export interface GraphViewProps {
  readonly nodes: readonly GraphViewNode[];
  readonly edges: readonly GraphViewEdge[];
  readonly focusNodeId: string;
  readonly trailNodeIds: readonly string[];
  readonly selectedNodeId: string | null;
}

/** "+ 15 more", "+ ~1,240 more" (estimated), or "+ more" (unknown count). */
export function overflowLabel(
  remaining: number | null,
  isEstimated: boolean,
  locale?: string,
): string {
  if (remaining === null) return "+ more";
  const formatted = new Intl.NumberFormat(locale).format(remaining);
  return `+ ${isEstimated ? "~" : ""}${formatted} more`;
}

function nodeView(
  node: GraphNodeModel,
  labelFor: (id: string) => string,
  locale?: string,
): GraphViewNode {
  if (node.kind === "overflow") {
    const label = overflowLabel(node.remaining, node.isEstimated, locale);
    const count =
      node.remaining === null
        ? "more"
        : `${node.isEstimated ? "about " : ""}${new Intl.NumberFormat(locale).format(node.remaining)} more`;
    return {
      id: node.id,
      kind: "overflow",
      label,
      sublabel: node.relationTitle,
      color: node.color,
      emphasis: "normal",
      estimated: node.isEstimated,
      ariaLabel: `${count} ${node.relationTitle} of ${labelFor(graphNodeId(node.owner))} — open the full list`,
    };
  }
  const emphasis =
    node.role === "focus" || node.role === "previous-focus" || node.role === "trail"
      ? node.role
      : "normal";
  return {
    id: node.id,
    kind: "item",
    label: node.loading ? "Loading…" : node.label,
    sublabel: node.entityTitle,
    color: node.color,
    icon: node.icon,
    emphasis,
    muted: node.loading || node.unavailable,
    ariaLabel: `${node.entityTitle} ${node.loading ? "(loading)" : node.label}${
      node.role === "focus" ? ", current item" : ""
    }`,
  };
}

function edgeView(edge: GraphEdgeModel, labelFor: (id: string) => string): GraphViewEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.relationTitle,
    emphasis: edge.onTrail ? "trail" : "normal",
    ariaLabel: edge.toOverflow
      ? `${edge.relationTitle} of ${labelFor(edge.source)}: more items`
      : `${labelFor(edge.source)} — ${edge.relationTitle} → ${labelFor(edge.target)}`,
  };
}

function selectedNodeIdOf(selection: GraphSelection | null, model: GraphModel): string | null {
  if (!selection) return null;
  if (selection.kind === "node") return graphNodeId(selection.ref);
  if (selection.kind === "overflow") {
    return (
      model.nodes.find(
        (n) =>
          n.kind === "overflow" &&
          n.owner.id === selection.owner.id &&
          n.relationName === selection.relation,
      )?.id ?? null
    );
  }
  return null;
}

/** Maps the graph model to the ui pattern's plain props — no accessor objects cross this line. */
export function toKnowledgeGraphProps(
  model: GraphModel,
  state: Pick<GraphState, "trail" | "selected">,
  locale?: string,
): GraphViewProps {
  const labels = new Map<string, string>(
    model.nodes.map((n) => [n.id, n.kind === "item" ? n.label : n.relationTitle]),
  );
  const labelFor = (id: string) => labels.get(id) ?? id;
  return {
    nodes: model.nodes.map((n) => nodeView(n, labelFor, locale)),
    edges: model.edges.map((e) => edgeView(e, labelFor)),
    focusNodeId: graphNodeId(state.trail[state.trail.length - 1]!),
    trailNodeIds: state.trail.map((t) => graphNodeId(t)),
    selectedNodeId: selectedNodeIdOf(state.selected, model),
  };
}
