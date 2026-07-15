import { createFileRoute } from "@tanstack/react-router";
import { EntityProfileGate } from "@contentgrid/features/entity-browser";
import { ensureProfileEntity } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity")({
  // apiFetch/profileUrl are null until the router-context bridge in main.tsx
  // fires (auth-gated) — skip prefetching until then and let
  // EntityProfileGate's own useProfileEntity() fetch normally. A prefetch
  // failure here is swallowed the same way: an uncaught beforeLoad rejection
  // would block EntityProfileGate's component from mounting at all, skipping
  // its own LoadingPage/ErrorPage handling entirely.
  beforeLoad: async ({ context, params }) => {
    if (!context.apiFetch || !context.profileUrl) return {};
    try {
      const profileEntity = await ensureProfileEntity(
        context.queryClient,
        context.apiFetch,
        context.profileUrl,
        { name: params.entity },
      );
      return { profileEntity };
    } catch {
      return {};
    }
  },
  component: EntityProfileGate,
});
