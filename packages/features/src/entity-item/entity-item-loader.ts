import { type ProfileEntity, ensureEntityItem } from "@contentgrid/navigator-data";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * `profileEntity` comes from the parent `/$entity` route's `beforeLoad`
 * (`ensureEntityProfileLoaded`) merging into this route's context — `null`
 * when that resolved to no profile, absent entirely when it bailed out early
 * (`apiFetch`/`profileUrl` not yet available). Both mean "not prefetched".
 */
export interface EntityItemDetailLoaderContext extends AppRouterContext {
  profileEntity?: ProfileEntity | null;
}

/**
 * Route loader — shared by both apps' `$entity/$itemId.tsx` route files.
 * Prefetches the entity item into the `QueryClient` under the exact same key
 * `useEntityItem({ profileEntity, entityId })` reads, so `EntityItemView`
 * resolves from cache instead of waterfalling a fetch after the profile gate
 * settles.
 */
export async function ensureEntityItemDetailLoaderData(
  context: EntityItemDetailLoaderContext,
  itemId: string,
): Promise<void> {
  const { apiFetch, profileEntity, queryClient } = context;
  // apiFetch is null until the router-context bridge fires (auth-gated), and
  // profileEntity is absent/null when the parent gate's own prefetch bailed —
  // in either case, skip prefetching and let EntityItemView's own
  // useEntityItem() fetch normally, with its own isPending/isError handling.
  if (!apiFetch || !profileEntity) return;
  try {
    await ensureEntityItem(queryClient, apiFetch, profileEntity, itemId);
  } catch {
    // Swallowed: an uncaught loader rejection would block the route
    // component from mounting at all, skipping EntityItemView's own
    // isPending/isError handling entirely.
  }
}
