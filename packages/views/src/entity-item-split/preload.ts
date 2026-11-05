import { preloadEntityItemCollection } from "../entity-item-collection/preload";
import { preloadEntityItemPreview } from "../entity-item-preview/preload";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Preload for the split view: starts both children's preloads together (contract
 * `view-data-loading.md` rule 5) — the list's profile and, when an item is already selected, that
 * item. Never rejects, like the children's.
 */
export async function preloadEntityItemSplit(
  ctx: AppRouterContext,
  entityName: string,
  itemId?: string,
): Promise<void> {
  await Promise.all([
    preloadEntityItemCollection(ctx, entityName),
    itemId === undefined ? undefined : preloadEntityItemPreview(ctx, entityName, itemId),
  ]);
}
