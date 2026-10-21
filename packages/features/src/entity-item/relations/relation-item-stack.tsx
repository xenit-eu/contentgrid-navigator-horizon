import { type ReactNode, useEffect, useState } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { EntityItemReference } from "../variations/entity-item-reference";

/** How many more items each "Load more" click reveals (and how many show at first). */
export const RELATION_ITEM_STACK_STEP = 5;

export interface RelationItemStackProps {
  /** Every item loaded so far, across all fetched pages, in order. */
  readonly items: readonly EntityItem[];
  /** Whether the server has further pages beyond `items`. */
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => void;
  readonly onItemClick?: (item: EntityItem) => void;
  /** Extra per-item controls (e.g. unlink/delete) rendered after each reference. */
  readonly renderItemActions?: (item: EntityItem) => ReactNode;
}

/**
 * Compact to-many relation body for narrow panes: a vertical stack of item references showing
 * `RELATION_ITEM_STACK_STEP` items at first, with a "Load more" button that reveals the next
 * `RELATION_ITEM_STACK_STEP`. Items already loaded are revealed straight away; the next server
 * page is only fetched once the revealed count runs past what is loaded.
 */
export function RelationItemStack({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onItemClick,
  renderItemActions,
}: Readonly<RelationItemStackProps>) {
  const [visibleCount, setVisibleCount] = useState(RELATION_ITEM_STACK_STEP);

  // Keep fetching pages until enough are loaded to fill the revealed count (a server page can
  // hold fewer items than one step) or the relation runs out.
  const needsMore = items.length < visibleCount && hasNextPage;
  useEffect(() => {
    if (needsMore && !isFetchingNextPage) fetchNextPage();
  }, [needsMore, isFetchingNextPage, fetchNextPage]);

  const visibleItems = items.slice(0, visibleCount);
  const canLoadMore = items.length > visibleCount || hasNextPage;

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {visibleItems.map((item) => (
          <li key={item.id} className="flex items-center gap-1">
            <EntityItemReference
              item={item}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              className="min-w-0 flex-1 p-1.5"
            />
            {renderItemActions?.(item)}
          </li>
        ))}
      </ul>
      {canLoadMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isFetchingNextPage}
          onClick={() => setVisibleCount((count) => count + RELATION_ITEM_STACK_STEP)}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
