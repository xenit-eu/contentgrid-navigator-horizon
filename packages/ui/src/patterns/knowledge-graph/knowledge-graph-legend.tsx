import { DatabaseIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { IconBadge } from "../../primitives/icon-badge";
import { resolveEntityIcon } from "../icon-picker/icon-picker";

/** One node type in the legend. Plain values only, like `KnowledgeGraphNode`. */
export interface KnowledgeGraphLegendItem {
  readonly id: string;
  readonly label: string;
  /** Any CSS colour. Defaults to `var(--muted-foreground)`, like the nodes. */
  readonly color?: string;
  /** Icon name from `ENTITY_ICON_OPTIONS` (resolved via `resolveEntityIcon`). */
  readonly icon?: string;
  /** How many nodes of this type the graph holds. Omit to show none. */
  readonly count?: number;
  /** `false` = this type is filtered out of the graph. */
  readonly active: boolean;
}

export interface KnowledgeGraphLegendProps {
  readonly items: readonly KnowledgeGraphLegendItem[];
  /** Fired with the item's id when its toggle is clicked. */
  readonly onToggle: (id: string) => void;
  /** Accessible name of the legend. Defaults to `"Node types"`. */
  readonly label?: string;
  readonly className?: string;
}

/**
 * A single, horizontally scrolling row of node types, each a toggle styled like the graph's item
 * nodes (icon badge in the type's colour, label, count). An inactive type is drawn dashed and
 * faded; the caller decides what toggling means (typically hiding that type's nodes).
 */
export function KnowledgeGraphLegend({
  items,
  onToggle,
  label = "Node types",
  className,
}: Readonly<KnowledgeGraphLegendProps>) {
  if (items.length === 0) return null;

  return (
    <ul
      aria-label={label}
      className={cn("scrollbar-subtle flex gap-2 overflow-x-auto px-2 py-2", className)}
    >
      {items.map((item) => {
        const Icon = resolveEntityIcon(item.icon) ?? DatabaseIcon;
        return (
          <li key={item.id} className="shrink-0">
            <button
              type="button"
              aria-pressed={item.active}
              onClick={() => onToggle(item.id)}
              title={item.active ? `Hide ${item.label}` : `Show ${item.label}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border bg-card py-1 pr-2.5 pl-1.5 text-card-foreground outline-none transition-[opacity,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50",
                item.active
                  ? "shadow-e1 hover:border-ring"
                  : "border-dashed opacity-50 hover:opacity-80",
              )}
            >
              <IconBadge icon={<Icon />} color={item.color} muted variant="sm" />
              <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
