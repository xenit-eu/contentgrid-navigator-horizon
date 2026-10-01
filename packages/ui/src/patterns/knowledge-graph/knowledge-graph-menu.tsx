import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "../../primitives/popover";
import type { KnowledgeGraphMenuItem } from "./knowledge-graph.types";

export interface KnowledgeGraphMenuProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The element the menu is anchored to (a node, or an edge label). */
  readonly anchor: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly items: readonly KnowledgeGraphMenuItem[];
  readonly footer?: ReactNode;
  /** Element to move focus back to when the menu closes. */
  readonly returnFocusTo?: () => HTMLElement | null;
}

/**
 * Popover menu anchored to a graph element. Closes on Escape / outside interaction (reported via
 * `onOpenChange(false)`), and returns focus to the originating graph element on close.
 */
export function KnowledgeGraphMenu({
  open,
  onOpenChange,
  anchor,
  title,
  description,
  items,
  footer,
  returnFocusTo,
}: Readonly<KnowledgeGraphMenuProps>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        className="nodrag nopan nowheel w-64 p-2"
        side="bottom"
        align="center"
        // The anchor lives inside React Flow's CSS-transformed viewport, which pans/zooms without
        // scroll or resize events — re-measure every frame so the menu follows its anchor.
        updatePositionStrategy="always"
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo?.();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <PopoverHeader className="px-2 pt-1 pb-2">
          <PopoverTitle className="truncate" title={title}>
            {title}
          </PopoverTitle>
          {description ? (
            <PopoverDescription className="text-xs break-words">{description}</PopoverDescription>
          ) : null}
        </PopoverHeader>
        <div role="menu" aria-label={title} className="flex flex-col gap-0.5">
          {items.map((item) => (
            <Button
              key={item.id}
              role="menuitem"
              type="button"
              size="sm"
              variant={item.destructive ? "destructive" : "ghost"}
              disabled={item.disabled}
              className={cn("justify-start", item.destructive && "mt-1")}
              onClick={() => item.onSelect()}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </PopoverContent>
    </Popover>
  );
}
