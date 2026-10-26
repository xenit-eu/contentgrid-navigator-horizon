import { ensureProfileEntity } from "@contentgrid/navigator-data";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Preload for the collection view: fills the cache with the profile under the key
 * `useProfileEntity` reads. The first page is fetched by the feature itself, so it is not loaded
 * here. It resolves, and never rejects, so a failure is shown by the view's own loading/error
 * handling; it returns without loading while the API client is absent.
 */
export async function preloadEntityItemCollection(
  ctx: AppRouterContext,
  entityName: string,
): Promise<void> {
  const { apiFetch, profileUrl, queryClient } = ctx;
  if (!apiFetch || !profileUrl) return;
  try {
    await ensureProfileEntity(queryClient, apiFetch, profileUrl, { name: entityName });
  } catch {
    // Swallowed: an uncaught loader rejection would stop the route from mounting at all.
  }
}
