import { ensureViewTarget } from "@contentgrid/navigator-data";
import type { ViewPreload } from "../types";

/**
 * Preload for the item detail view (contract `view-preload.md`): fills the cache with the profile
 * and the item under the keys the view reads. It resolves, and never rejects, so a failure is
 * shown by the view's own gate; it returns without loading while the API client is absent.
 */
export const preload: ViewPreload<never> = async (ctx, target) => {
  const { apiFetch, profileUrl, queryClient } = ctx;
  if (!apiFetch || !profileUrl) return;
  try {
    await ensureViewTarget(queryClient, apiFetch, profileUrl, target);
  } catch {
    // Swallowed: an uncaught loader rejection would stop the route from mounting at all.
  }
};
