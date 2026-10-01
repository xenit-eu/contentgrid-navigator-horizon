import { memo } from "react";
import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";
import { cn } from "../../../lib/utils";
import { useKnowledgeGraphContext } from "../knowledge-graph-context";
import { KnowledgeGraphMenu } from "../knowledge-graph-menu";
import type { KnowledgeGraphEdge } from "../knowledge-graph.types";
import { type Box, linkPath, selfLoopPath } from "./edge-geometry";
import { siblingOffset } from "./edge-siblings";

export type RelationFlowEdge = Edge<{ edge: KnowledgeGraphEdge }, "relation">;

function boxOf(node: InternalNode): Box {
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  return {
    x: node.internals.positionAbsolute.x + width / 2,
    y: node.internals.positionAbsolute.y + height / 2,
    width,
    height,
  };
}

/**
 * Labelled, directed relation edge: straight for a single link, curved apart for parallel links
 * between the same pair, a loop for a self-relation. The label is HTML (clickable, focusable) and
 * anchors the edge menu.
 */
function RelationEdgeComponent({
  id,
  source,
  target,
  data,
  markerEnd,
}: EdgeProps<RelationFlowEdge>) {
  const ctx = useKnowledgeGraphContext();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode || !data) return null;

  const { edge } = data;
  const sibling = ctx.siblings.get(id);
  const geometry =
    source === target
      ? selfLoopPath(boxOf(sourceNode), sibling?.index ?? 0)
      : linkPath(
          boxOf(sourceNode),
          boxOf(targetNode),
          // Normalise the bend direction so A→B and B→A siblings never overlap.
          source < target ? siblingOffset(sibling) : -siblingOffset(sibling),
        );

  const menu = ctx.edgeMenu?.edgeId === id ? ctx.edgeMenu : null;
  const label = (
    <button
      type="button"
      data-kg-edge-label={id}
      className={cn(
        "nodrag nopan pointer-events-auto absolute flex max-w-40 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs text-foreground shadow-e1",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        edge.emphasis === "trail" && "font-semibold",
        menu && "ring-2 ring-ring",
      )}
      style={{
        transform: `translate(-50%, -50%) translate(${geometry.labelX}px, ${geometry.labelY}px)`,
      }}
      title={edge.label}
      aria-label={edge.ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        ctx.onEdgeClick(id);
      }}
    >
      {edge.status === "loading" ? (
        <CircleNotchIcon className="size-3 animate-spin" aria-label={ctx.labels.loading} />
      ) : null}
      {edge.status === "error" ? (
        <WarningCircleIcon className="size-3 text-destructive" aria-label={ctx.labels.error} />
      ) : null}
      <span className="truncate">{edge.label}</span>
    </button>
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={geometry.path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{ strokeWidth: edge.emphasis === "trail" ? 2.5 : 1.5 }}
      />
      <EdgeLabelRenderer>
        {menu ? (
          <KnowledgeGraphMenu
            open
            onOpenChange={ctx.onMenuOpenChange}
            anchor={label}
            title={menu.title}
            description={menu.description}
            items={menu.items}
            footer={menu.footer}
            returnFocusTo={() =>
              document.querySelector<HTMLElement>(`[data-kg-edge-label="${CSS.escape(id)}"]`)
            }
          />
        ) : (
          label
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationEdge = memo(RelationEdgeComponent);
