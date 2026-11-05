import { type ProfileEntity, ensureProfileEntity } from "@contentgrid/navigator-data";
import type { AppRouterContext } from "../shells/router-shell";

/**
 * Fills the cache with an entity's profile under the key `useProfileEntity` reads and returns it.
 * Never rejects: it returns `undefined` while the API client is absent (auth-gated, set once the
 * router-context bridge fires) and when the fetch fails, so the mounted view's own
 * loading/error handling shows the failure — an uncaught loader rejection would stop the route
 * from mounting at all.
 */
export async function ensureProfileEntityLoaded(
  ctx: AppRouterContext,
  entityName: string,
): Promise<ProfileEntity | null | undefined> {
  const { apiFetch, profileUrl, queryClient } = ctx;
  if (!apiFetch || !profileUrl) return undefined;
  try {
    return await ensureProfileEntity(queryClient, apiFetch, profileUrl, { name: entityName });
  } catch {
    return undefined;
  }
}
