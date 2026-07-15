import { createFileRoute } from "@tanstack/react-router";
import { EntityItemDetailPage } from "@contentgrid/features/entity-browser";
import { ensureEntityItem } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: async ({ context, params }) => {
    const { apiFetch, profileEntity, queryClient } = context;
    if (!apiFetch || !profileEntity) return;

    try {
      await ensureEntityItem(queryClient, apiFetch, profileEntity, params.itemId);
    } catch {
      // Swallowed: an uncaught loader rejection would block EntityItemDetailPage
      // from mounting at all. useEntityItem's own isError handling takes over
      // once the component renders.
    }
  },
  component: EntityItemDetailPage,
});
