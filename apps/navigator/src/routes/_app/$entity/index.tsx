import { createFileRoute } from "@tanstack/react-router";
import {
  EntityDetailPage,
  ensureEntityDetailLoaderData,
} from "@contentgrid/features/entity-browser";
import { entitySearchStateValidator } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ context, deps }) => {
    const { apiFetch, profileUrl, profileEntity, queryClient } = context;
    if (!apiFetch || !profileUrl || !profileEntity) return;

    await ensureEntityDetailLoaderData(
      queryClient,
      apiFetch,
      profileUrl,
      profileEntity,
      deps.cursor,
    );
  },
  component: EntityDetailPage,
});
