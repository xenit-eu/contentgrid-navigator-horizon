import { ensureProfileEntityLoaded } from "../preload/ensure-profile-entity";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Preload for the collection view: fills the cache with the profile under the key the view reads
 * (`useLoadedProfileEntities`, through `useProfileEntityTarget`). The first page is fetched by
 * the feature itself, so it is not loaded here. It resolves, and never rejects, so a failure is
 * shown by the view's own loading/error handling; it returns without loading while the API
 * client is absent. Behind the profile gate the `$entity` route's `beforeLoad` has already
 * loaded the same profile, so this is a cache hit there.
 */
export async function preloadEntityItemCollection(
  ctx: AppRouterContext,
  entityName: string,
): Promise<void> {
  await ensureProfileEntityLoaded(ctx, entityName);
}
