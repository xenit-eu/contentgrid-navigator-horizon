import type { ReactNode } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { EntityCard } from "@contentgrid/ui";
import { EntityItemReference } from "../item-reference/entity-item-reference";

export interface EntityItemCardProps {
  readonly item: EntityItem;
  /** Shown under the item's reference, e.g. the relation summary. */
  readonly summary?: ReactNode;
  /** The variation's `actions`, drawn in the card header's top-right corner. */
  readonly actions?: ReactNode;
  /** The card body, edge to edge — e.g. `EntityItemSections`. */
  readonly children?: ReactNode;
}

/**
 * The card the sections-based variations (`attribute-focus`, `side-by-side`) put the item in: the
 * item's reference as its heading, the caller's `actions` in its corner and the sections edge to
 * edge as its body.
 */
export function EntityItemCard({
  item,
  summary,
  actions,
  children,
}: Readonly<EntityItemCardProps>) {
  return (
    <EntityCard
      name={item.id}
      flushContent
      heading={
        <div className="space-y-1">
          <EntityItemReference item={item} size="lg" />
          {summary}
        </div>
      }
      action={
        actions && (
          <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )
      }
    >
      {children}
    </EntityCard>
  );
}
