import type { ReactNode } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { Card, CardContent, CardHeader } from "@contentgrid/ui";
import { EntityItemReference } from "../item-reference/entity-item-reference";

export interface EntityItemCardProps {
  readonly item: EntityItem;
  /** Shown under the item's reference, e.g. the relation summary. */
  readonly summary?: ReactNode;
  /** The variation's `actions`, drawn in the card header's top-right corner. */
  readonly actions?: ReactNode;
  /** The card body, edge to edge — e.g. `EntityItemSections`. */
  readonly children: ReactNode;
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
    <Card data-slot="entity-item-card" className="gap-1 overflow-hidden pt-4 pb-0">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="min-w-0 flex-1 space-y-1">
          <EntityItemReference item={item} size="lg" />
          {summary}
        </div>
        {actions && (
          <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </CardHeader>
      <CardContent className="mt-auto px-0">{children}</CardContent>
    </Card>
  );
}
