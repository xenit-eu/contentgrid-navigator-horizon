import type { GraphModel } from "./build-graph-model";
import { overflowLabel } from "./to-knowledge-graph-props";

export interface GraphOutlineGroupModel {
  readonly relationName: string;
  readonly relationTitle: string;
  readonly targets: readonly {
    readonly nodeId: string;
    readonly edgeId: string;
    readonly label: string;
  }[];
  readonly overflow?: { readonly nodeId: string; readonly label: string };
}

/** The focus item's relations as a plain list (for the accessible relations outline, FR-028). */
export function graphOutlineGroups(
  model: GraphModel,
  focusNodeId: string,
  locale?: string,
): GraphOutlineGroupModel[] {
  const labels = new Map(model.nodes.map((n) => [n.id, n]));
  const groups = new Map<
    string,
    {
      relationName: string;
      relationTitle: string;
      targets: { nodeId: string; edgeId: string; label: string }[];
      overflow?: { nodeId: string; label: string };
    }
  >();
  for (const edge of model.edges) {
    if (edge.source !== focusNodeId) continue;
    const group = groups.get(edge.relationName) ?? {
      relationName: edge.relationName,
      relationTitle: edge.relationTitle,
      targets: [],
    };
    const node = labels.get(edge.target);
    if (node?.kind === "overflow") {
      group.overflow = {
        nodeId: node.id,
        label: overflowLabel(node.remaining, node.isEstimated, locale),
      };
    } else if (node) {
      group.targets.push({ nodeId: node.id, edgeId: edge.id, label: node.label });
    }
    groups.set(edge.relationName, group);
  }
  return [...groups.values()];
}
