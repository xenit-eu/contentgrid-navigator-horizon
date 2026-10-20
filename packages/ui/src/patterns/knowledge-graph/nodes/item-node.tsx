import { memo } from "react";
import { DatabaseIcon } from "@phosphor-icons/react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { cn } from "../../../lib/utils";
import { IconBadge } from "../../../primitives/icon-badge";
import { resolveEntityIcon } from "../../icon-picker/icon-picker";
import { useKnowledgeGraphContext } from "../knowledge-graph-context";
import { KnowledgeGraphMenu } from "../knowledge-graph-menu";
import type { KnowledgeGraphNode } from "../knowledge-graph.types";

export type ItemFlowNode = Node<{ node: KnowledgeGraphNode }, "item">;

/** Width used by the layout and the edge geometry; kept in sync with the node's CSS width. */
export const ITEM_NODE_WIDTH = 184;

const HIDDEN_HANDLE = "!pointer-events-none !opacity-0 !border-0 !min-w-0 !min-h-0 !w-px !h-px";

function ItemNodeComponent({ id, data }: NodeProps<ItemFlowNode>) {
  const { node } = data;
  const ctx = useKnowledgeGraphContext();
  const Icon = resolveEntityIcon(node.icon) ?? DatabaseIcon;
  const color = node.color ?? "var(--muted-foreground)";
  const selected = ctx.selectedNodeId === id;
  const menu = ctx.nodeMenu?.nodeId === id ? ctx.nodeMenu : null;

  const body = (
    <div
      data-kg-node={id}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-card-foreground shadow-e1 transition-shadow",
        node.emphasis === "focus" && "border-2",
        node.emphasis === "trail" && "border-dashed",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        node.muted && "opacity-60",
      )}
      style={{
        width: ITEM_NODE_WIDTH,
        borderColor: node.emphasis === "focus" ? color : undefined,
      }}
      title={node.sublabel ? `${node.label} — ${node.sublabel}` : node.label}
    >
      <IconBadge icon={<Icon />} color={node.color} muted variant="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-tight">{node.label}</div>
        {node.sublabel ? (
          <div className="truncate text-xs text-muted-foreground leading-tight">
            {node.sublabel}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={HIDDEN_HANDLE}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={HIDDEN_HANDLE}
        isConnectable={false}
      />
      {menu ? (
        <KnowledgeGraphMenu
          open
          onOpenChange={ctx.onMenuOpenChange}
          anchor={body}
          title={menu.title}
          description={menu.description}
          items={menu.items}
          footer={menu.footer}
          returnFocusTo={() =>
            document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
          }
        />
      ) : (
        body
      )}
    </>
  );
}

export const ItemNode = memo(ItemNodeComponent);
