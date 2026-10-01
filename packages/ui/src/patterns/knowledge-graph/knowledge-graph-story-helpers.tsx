import { type ReactNode, useState } from "react";
import { fn } from "storybook/test";
import { KnowledgeGraph } from "./knowledge-graph";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphProps,
} from "./knowledge-graph.types";

/*
 * Shared fixtures for the KnowledgeGraph stories. Named without `.stories.` so Storybook's glob
 * does not treat this module as a story file (same convention as pdf-viewer-story-helpers).
 */

export const CUSTOMER = "oklch(0.55 0.17 155)";
export const ORDER = "oklch(0.6 0.15 250)";
export const PRODUCT = "oklch(0.65 0.16 60)";

export function item(
  id: string,
  label: string,
  sublabel: string,
  color: string | undefined,
  emphasis: KnowledgeGraphNode["emphasis"] = "normal",
): KnowledgeGraphNode {
  return {
    id,
    kind: "item",
    label,
    sublabel,
    color,
    icon: "Database",
    emphasis,
    ariaLabel: `${sublabel} ${label}`,
  };
}

export function edge(
  source: string,
  relation: string,
  target: string,
  emphasis: KnowledgeGraphEdge["emphasis"] = "normal",
  status?: KnowledgeGraphEdge["status"],
): KnowledgeGraphEdge {
  return {
    id: `${source}->${relation}->${target}`,
    source,
    target,
    label: relation,
    emphasis,
    status,
    ariaLabel: `${source} — ${relation} → ${target}`,
  };
}

export const defaultNodes: KnowledgeGraphNode[] = [
  item("c1", "Big Corp", "Customer", CUSTOMER, "focus"),
  item("o1", "ORD-001", "Order", ORDER),
  item("o2", "ORD-002", "Order", ORDER),
  item("o3", "ORD-003", "Order", ORDER),
  item("a1", "Alice Martens", "Account manager", undefined),
];

export const defaultEdges: KnowledgeGraphEdge[] = [
  edge("c1", "Orders", "o1"),
  edge("c1", "Orders", "o2"),
  edge("c1", "Orders", "o3"),
  edge("c1", "Account manager", "a1"),
];

export const baseArgs: KnowledgeGraphProps = {
  nodes: defaultNodes,
  edges: defaultEdges,
  focusNodeId: "c1",
  trailNodeIds: ["c1"],
  onNodeClick: fn(),
  onEdgeClick: fn(),
  onPaneClick: fn(),
  onMenuOpenChange: fn(),
};

export function StoryFrame({ children }: { readonly children: ReactNode }) {
  return <div style={{ width: 960, height: 600 }}>{children}</div>;
}

/**
 * Stateful harness: clicking a node or edge opens its menu, like the knowledge-graph feature does.
 */
export function InteractiveKnowledgeGraph(props: Readonly<KnowledgeGraphProps>) {
  const [menu, setMenu] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  return (
    <KnowledgeGraph
      {...props}
      selectedNodeId={menu?.kind === "node" ? menu.id : null}
      onNodeClick={(id) => {
        props.onNodeClick(id);
        setMenu({ kind: "node", id });
      }}
      onEdgeClick={(id) => {
        props.onEdgeClick(id);
        setMenu({ kind: "edge", id });
      }}
      onMenuOpenChange={(open) => !open && setMenu(null)}
      nodeMenu={
        menu?.kind === "node"
          ? {
              nodeId: menu.id,
              title: props.nodes.find((n) => n.id === menu.id)?.label ?? menu.id,
              items: [
                { id: "view", label: "View", onSelect: () => setMenu(null) },
                { id: "explore", label: "Explore relations", onSelect: () => setMenu(null) },
                { id: "delete", label: "Delete", destructive: true, onSelect: () => setMenu(null) },
              ],
            }
          : null
      }
      edgeMenu={
        menu?.kind === "edge"
          ? {
              edgeId: menu.id,
              title: props.edges.find((e) => e.id === menu.id)?.label ?? menu.id,
              description: menu.id.replaceAll("->", " → "),
              items: [
                {
                  id: "remove",
                  label: "Remove link",
                  destructive: true,
                  onSelect: () => setMenu(null),
                },
              ],
            }
          : null
      }
    />
  );
}
