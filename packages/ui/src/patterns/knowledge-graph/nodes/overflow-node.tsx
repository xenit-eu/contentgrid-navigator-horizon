import { memo } from "react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { cn } from "../../../lib/utils";
import { useKnowledgeGraphContext } from "../knowledge-graph-context";
import type { KnowledgeGraphNode } from "../knowledge-graph.types";

export type OverflowFlowNode = Node<{ node: KnowledgeGraphNode }, "overflow">;

const HIDDEN_HANDLE = "!pointer-events-none !opacity-0 !border-0 !min-w-0 !min-h-0 !w-px !h-px";

/** "+ N more" pill standing in for the undrawn targets of one to-many relation. */
function OverflowNodeComponent({ id, data }: NodeProps<OverflowFlowNode>) {
  const { node } = data;
  const ctx = useKnowledgeGraphContext();
  const color = node.color ?? "var(--muted-foreground)";
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
          "flex flex-col items-center rounded-full border border-dashed bg-background px-4 py-1.5 text-center shadow-e1",
          ctx.selectedNodeId === id && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={{
          borderColor: color,
          backgroundColor: `color-mix(in oklch, ${color} 12%, var(--background))`,
        }}
        title={node.sublabel ? `${node.label} — ${node.sublabel}` : node.label}
      >
        <span className="text-sm font-semibold whitespace-nowrap">
          {node.label}
          {node.estimated ? <span className="sr-only"> ({ctx.labels.estimated})</span> : null}
        </span>
        {node.sublabel ? (
          <span className="max-w-36 truncate text-xs text-foreground/80">{node.sublabel}</span>
        ) : null}
      </div>
    </>
  );
}

export const OverflowNode = memo(OverflowNodeComponent);
