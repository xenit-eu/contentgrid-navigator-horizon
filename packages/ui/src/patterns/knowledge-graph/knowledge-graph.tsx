import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef } from "react";
import {
  Controls,
  type Edge,
  type EdgeTypes,
  MarkerType,
  type Node,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { cn } from "../../lib/utils";
import { computeEdgeSiblings } from "./edges/edge-siblings";
import { RelationEdge } from "./edges/relation-edge";
import { KnowledgeGraphContext, type KnowledgeGraphContextValue } from "./knowledge-graph-context";
import type { KnowledgeGraphLabels, KnowledgeGraphProps } from "./knowledge-graph.types";
import { type LayoutPoint, radialLayout } from "./layout/radial-layout";
import { COMPACT_CONTENT_NODE_SIZE, CONTENT_NODE_WIDTH, ContentNode } from "./nodes/content-node";
import { ITEM_NODE_WIDTH, ItemNode } from "./nodes/item-node";
import { OverflowNode } from "./nodes/overflow-node";

// Module-level so React Flow never sees new type maps (which would remount every node).
const nodeTypes: NodeTypes = { item: ItemNode, overflow: OverflowNode, content: ContentNode };
const edgeTypes: EdgeTypes = { relation: RelationEdge };

/** Half of each node kind's width: React Flow positions are top-left, the layout yields centres. */
const NODE_HALF_WIDTH = {
  item: ITEM_NODE_WIDTH / 2,
  overflow: 64,
  content: CONTENT_NODE_WIDTH / 2,
} as const;

const DEFAULT_LABELS: KnowledgeGraphLabels = {
  graph: "Relations graph",
  usageHint:
    "Use Tab to move between items and relations, Enter to select the focused one, the Menu key or Shift+F10 to open its actions, Escape to close.",
  nodeDescription: "Press Enter to show this item's details and actions.",
  edgeDescription: "Press Enter to show this relation's actions.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitView: "Fit graph to view",
  estimated: "estimated",
  loading: "Loading",
  error: "Failed to load",
};

/**
 * Re-fits the viewport (animated) whenever the focus node or the set of visible nodes changes —
 * relation targets arrive after the first render, so React Flow's own initial `fitView` (run as
 * soon as the first node is measured) would otherwise leave later nodes outside the view.
 */
function FitOnGraphChange({ graphKey }: { readonly graphKey: string }) {
  const { fitView } = useReactFlow();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      void fitView({ duration: 250, padding: 0.2, maxZoom: 1.1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [graphKey, fitView]);
  return null;
}

/**
 * Re-fits (without animation) when the canvas itself changes size — e.g. the side panel stacking
 * below the graph on narrow screens after the initial fit already ran against a different size.
 */
function FitOnResize() {
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (width === 0 || height === 0) return;
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.2, maxZoom: 1.1 }));
    return () => cancelAnimationFrame(frame);
  }, [width, height, fitView]);
  return null;
}

function KnowledgeGraphCanvas({
  nodes,
  edges,
  focusNodeId,
  trailNodeIds,
  selectedNodeId = null,
  onNodeClick,
  onEdgeClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneClick,
  nodeMenu = null,
  edgeMenu = null,
  onMenuOpenChange,
  labels: labelOverrides,
  className,
}: Readonly<KnowledgeGraphProps>) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const hintId = useId();
  const previousPositions = useRef<Record<string, LayoutPoint>>({});

  const positions = useMemo(() => {
    // Compact file icons sit right next to the item linking to them.
    const compact = new Set(
      nodes.filter((n) => n.kind === "content" && n.compact).map((n) => n.id),
    );
    const attachments: Record<string, string> = {};
    for (const edge of edges) {
      if (compact.has(edge.target)) attachments[edge.target] = edge.source;
    }
    const next = radialLayout({
      nodeIds: nodes.map((n) => n.id),
      edges,
      focusNodeId,
      trailNodeIds,
      previous: previousPositions.current,
      attachments,
    });
    return next;
  }, [nodes, edges, focusNodeId, trailNodeIds]);

  useEffect(() => {
    previousPositions.current = positions;
  }, [positions]);

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => {
        const p = positions[node.id] ?? { x: 0, y: 0 };
        const compact = node.kind === "content" && node.compact;
        const halfWidth = compact ? COMPACT_CONTENT_NODE_SIZE / 2 : NODE_HALF_WIDTH[node.kind];
        const halfHeight = compact ? COMPACT_CONTENT_NODE_SIZE / 2 : 24;
        return {
          id: node.id,
          type: node.kind,
          // React Flow positions are top-left; the layout yields centres.
          position: { x: p.x - halfWidth, y: p.y - halfHeight },
          data: { node },
          ariaLabel: node.ariaLabel,
          draggable: false,
          connectable: false,
          selectable: true,
        };
      }),
    [nodes, positions],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "relation",
        data: { edge },
        ariaLabel: edge.ariaLabel,
        markerEnd:
          edge.variant === "content"
            ? undefined
            : { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        focusable: true,
      })),
    [edges],
  );

  const siblings = useMemo(() => computeEdgeSiblings(edges), [edges]);

  const closeMenu = useCallback(
    (open: boolean) => {
      if (!open) onMenuOpenChange?.(false);
    },
    [onMenuOpenChange],
  );

  const context = useMemo<KnowledgeGraphContextValue>(
    () => ({
      selectedNodeId,
      nodeMenu,
      edgeMenu,
      onMenuOpenChange: closeMenu,
      onEdgeClick,
      onEdgeContextMenu,
      siblings,
      labels,
    }),
    [
      selectedNodeId,
      nodeMenu,
      edgeMenu,
      closeMenu,
      onEdgeClick,
      onEdgeContextMenu,
      siblings,
      labels,
    ],
  );

  // Keyboard access (React Flow only selects): Enter/Space on a focused node or edge = click; the
  // Menu key or Shift+F10 = right-click.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isClick = event.key === "Enter" || event.key === " ";
    const isContextMenu = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
    if (!isClick && !isContextMenu) return;
    const target = event.target as HTMLElement;
    const nodeEl = target.closest<HTMLElement>(".react-flow__node");
    if (nodeEl?.dataset.id && nodeEl === target) {
      const handler = isClick ? onNodeClick : onNodeContextMenu;
      if (!handler) return;
      event.preventDefault();
      handler(nodeEl.dataset.id);
      return;
    }
    const edgeEl = target.closest<SVGGElement>(".react-flow__edge");
    const edgeId = edgeEl?.getAttribute("data-id");
    if (edgeId && edgeEl === (target as unknown as SVGGElement)) {
      const handler = isClick ? onEdgeClick : onEdgeContextMenu;
      if (!handler) return;
      event.preventDefault();
      handler(edgeId);
    }
  };

  return (
    <KnowledgeGraphContext.Provider value={context}>
      <div
        className={cn("relative h-full min-h-80 w-full", className)}
        onKeyDown={onKeyDown}
        data-slot="knowledge-graph"
      >
        <span id={hintId} className="sr-only">
          {labels.usageHint}
        </span>
        {/* React Flow's root already carries role="application"; name and describe it there. */}
        <ReactFlow
          aria-label={labels.graph}
          aria-describedby={hintId}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          onEdgeClick={(_, edge) => onEdgeClick(edge.id)}
          onNodeContextMenu={
            onNodeContextMenu
              ? (event, node) => {
                  event.preventDefault();
                  onNodeContextMenu(node.id);
                }
              : undefined
          }
          onEdgeContextMenu={
            onEdgeContextMenu
              ? (event, edge) => {
                  event.preventDefault();
                  onEdgeContextMenu(edge.id);
                }
              : undefined
          }
          onPaneClick={() => {
            onMenuOpenChange?.(false);
            onPaneClick?.();
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable
          edgesFocusable
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={2}
          ariaLabelConfig={{
            "node.a11yDescription.default": labels.nodeDescription,
            "edge.a11yDescription.default": labels.edgeDescription,
            "controls.zoomIn.ariaLabel": labels.zoomIn,
            "controls.zoomOut.ariaLabel": labels.zoomOut,
            "controls.fitView.ariaLabel": labels.fitView,
          }}
        >
          <Controls showInteractive={false} position="bottom-right" />
          <FitOnGraphChange graphKey={`${focusNodeId}|${nodes.map((n) => n.id).join(",")}`} />
          <FitOnResize />
        </ReactFlow>
      </div>
    </KnowledgeGraphContext.Provider>
  );
}

/**
 * Interactive, traversable graph of items and their named, directed relations.
 *
 * A plain-props pattern: the consumer supplies node/edge view models, which node is the focus,
 * the trail from the root, and menu contents; this component owns rendering (React Flow), a
 * deterministic radial layout, parallel-edge/self-loop geometry, keyboard access, and menu
 * anchoring. It performs no navigation or data mutation itself.
 */
export function KnowledgeGraph(props: Readonly<KnowledgeGraphProps>) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
