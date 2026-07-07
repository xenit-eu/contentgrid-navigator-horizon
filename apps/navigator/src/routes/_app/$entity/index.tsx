import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage, validateEntitySearchState } from "@contentgrid/features/entity-list";
import {
  bestEffortPrefetch,
  ensureEntityItemCollection,
  ensureProfileEntityByName,
} from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: validateEntitySearchState,
  // Only the cursor affects which page gets prefetched — filters/sort aren't
  // in scope yet (see EntitySearchState). Re-runs the loader on cursor change
  // so Next/Previous prime the cache too, not just the initial page load.
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  // Best-effort: see bestEffortPrefetch's docstring for why a failed prefetch
  // (e.g. not yet authenticated) must not crash the route — EntityDetailPage's
  // own useProfileEntities()/useEntityItemCollection() calls take over.
  loader: ({ context: { queryClient, apiFetch, profileUrl }, params, deps }) =>
    bestEffortPrefetch(async () => {
      const profileEntity = await ensureProfileEntityByName(
        queryClient,
        apiFetch,
        profileUrl,
        params.entity,
      );
      if (!profileEntity) return; // unknown entity name — component handles the not-found state
      await ensureEntityItemCollection(queryClient, apiFetch, {
        profileEntity,
        cursor: deps.cursor,
      });
    }),
  component: EntityDetailPage,
});
