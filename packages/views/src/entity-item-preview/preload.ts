import { preloadEntityItemDetail } from "../entity-item-detail/preload";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Preload for the item preview view. Kept as the view's own export: contract
 * `view-data-loading.md` rule 5 has a parent's preload call each child's preload (the split's).
 * It reads the same profile and item as the detail view, under the same cache keys, so it fills
 * them the same way (`preloadEntityItemDetail`). Never rejects, and returns without loading while
 * the API client is absent.
 */
export async function preloadEntityItemPreview(
  ctx: AppRouterContext,
  entityName: string,
  itemId: string,
): Promise<void> {
  await preloadEntityItemDetail(ctx, entityName, itemId);
}
