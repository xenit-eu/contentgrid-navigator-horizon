import { ensureEntityItem, ensureProfileEntity } from "@contentgrid/navigator-data";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Preload for the item detail view: fills the cache with the profile and the item under the keys
 * `useProfileEntity`/`useEntityItem` read. It resolves, and never rejects, so a failure is shown
 * by the view's own loading/error handling; it returns without loading while the API client is
 * absent.
 */
export async function preloadEntityItemDetail(
  ctx: AppRouterContext,
  entityName: string,
  itemId: string,
): Promise<void> {
  const { apiFetch, profileUrl, queryClient } = ctx;
  if (!apiFetch || !profileUrl) return;
  try {
    const profileEntity = await ensureProfileEntity(queryClient, apiFetch, profileUrl, {
      name: entityName,
    });
    if (profileEntity) {
      await ensureEntityItem(queryClient, apiFetch, profileEntity, itemId);
    }
  } catch {
    // Swallowed: an uncaught loader rejection would stop the route from mounting at all.
  }
}
