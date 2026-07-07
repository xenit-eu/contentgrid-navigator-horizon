import { createFileRoute } from "@tanstack/react-router";
import { EntityItemDetailPage, validateEntitySearchState } from "@contentgrid/features/entity-list";
import {
  bestEffortPrefetch,
  ensureEntityItem,
  ensureProfileEntityByName,
} from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  // The list page's cursor is carried into this route's own URL on row click
  // (see onRowClick in EntityDetailPage) so the breadcrumb can hand it back
  // when navigating to the list — this route never reads or acts on it itself.
  validateSearch: validateEntitySearchState,
  // Best-effort: see bestEffortPrefetch's docstring for why a failed prefetch
  // (e.g. not yet authenticated) must not crash the route — EntityItemDetailPage's
  // own useProfileEntities()/useEntityItem() calls take over.
  loader: ({ context: { queryClient, apiFetch, profileUrl }, params }) =>
    bestEffortPrefetch(async () => {
      const profileEntity = await ensureProfileEntityByName(
        queryClient,
        apiFetch,
        profileUrl,
        params.entity,
      );
      if (!profileEntity) return; // unknown entity name — component handles the not-found state
      await ensureEntityItem(queryClient, apiFetch, profileEntity, params.itemId);
    }),
  component: EntityItemDetailPage,
});
