import { ensureEntityItem } from "@contentgrid/navigator-data";
import { ensureProfileEntityLoaded } from "../preload/ensure-profile-entity";
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
  const { apiFetch, queryClient } = ctx;
  const profileEntity = await ensureProfileEntityLoaded(ctx, entityName);
  if (!profileEntity || !apiFetch) return;
  try {
    await ensureEntityItem(queryClient, apiFetch, profileEntity, itemId);
  } catch {
    // Swallowed: an uncaught loader rejection would stop the route from mounting at all.
  }
}
