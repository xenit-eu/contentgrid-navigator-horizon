import { memo } from "react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { cn } from "../../../lib/utils";
import { FileIcon } from "../../../primitives/file-icon";
import { useKnowledgeGraphContext } from "../knowledge-graph-context";
import type { KnowledgeGraphNode } from "../knowledge-graph.types";

export type ContentFlowNode = Node<{ node: KnowledgeGraphNode }, "content">;

/** Width used by the layout; kept in sync with the node's CSS width. */
export const CONTENT_NODE_WIDTH = 132;
/** Width and height of a `compact` (icon-only) content node. */
export const COMPACT_CONTENT_NODE_SIZE = 40;

const HIDDEN_HANDLE = "!pointer-events-none !opacity-0 !border-0 !min-w-0 !min-h-0 !w-px !h-px";

/**
 * A file held by an item, drawn as a compact vertical "file tile" — a muted header band holding a
 * big file-type icon, then the filename (up to two lines) and the attribute holding it — so it
 * reads differently from the horizontal item cards with their coloured badge.
 */
function ContentNodeComponent({ id, data }: NodeProps<ContentFlowNode>) {
  const { node } = data;
  const ctx = useKnowledgeGraphContext();
  const selected =
    ctx.selectedNodeId === id && "ring-2 ring-ring ring-offset-2 ring-offset-background";
  const title = node.sublabel ? `${node.label} — ${node.sublabel}` : node.label;

  if (node.compact) {
    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className={HIDDEN_HANDLE}
          isConnectable={false}
        />
        <div
          data-kg-node={id}
          className={cn(
            "flex items-center justify-center rounded-md border bg-card shadow-e1",
            selected,
          )}
          style={{ width: COMPACT_CONTENT_NODE_SIZE, height: COMPACT_CONTENT_NODE_SIZE }}
          title={title}
        >
          <FileIcon type={node.fileType ?? "doc"} size={28} />
        </div>
      </>
    );
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={HIDDEN_HANDLE}
        isConnectable={false}
      />
      <div
        data-kg-node={id}
        className={cn(
          "flex flex-col overflow-hidden rounded-md border bg-card text-center text-card-foreground shadow-e1",
          selected,
        )}
        style={{ width: CONTENT_NODE_WIDTH }}
        title={title}
      >
        <div className="flex justify-center border-b border-dashed bg-muted py-2">
          <FileIcon type={node.fileType ?? "doc"} size={32} />
        </div>
        <div className="space-y-0.5 px-2 py-1.5">
          <div className="line-clamp-2 text-xs font-medium leading-tight break-all">
            {node.label}
          </div>
          {node.sublabel ? (
            <div className="truncate text-[11px] text-muted-foreground leading-tight">
              {node.sublabel}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export const ContentNode = memo(ContentNodeComponent);
