import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage } from "@contentgrid/features/entity-browser";
import {
  ensureEntityItemCollection,
  entitySearchStateValidator,
} from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ context, deps }) => {
    const { apiFetch, profileUrl, profileEntity, queryClient } = context;
    if (!apiFetch || !profileUrl || !profileEntity) return;

    try {
      const searchParams = new URLSearchParams(deps.cursor ? { cursor: deps.cursor } : undefined);
      await ensureEntityItemCollection(
        queryClient,
        apiFetch,
        { profileEntity, searchParams },
        profileUrl,
      );
    } catch {
      // Swallowed: an uncaught loader rejection would block EntityDetailPage
      // from mounting at all. useEntityItemCollection's own isError handling
      // takes over once the component renders.
    }
  },
  component: EntityDetailPage,
});
