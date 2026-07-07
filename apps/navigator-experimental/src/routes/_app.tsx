import { createFileRoute } from "@tanstack/react-router";
import { EntityListLayout } from "@contentgrid/features/entity-list";

// No loader here: EntityListLayout is the shell for every route under /_app,
// so it mounts (and calls its own useProfileEntities()) essentially the
// instant this route matches — a prefetching loader would have no meaningful
// head start to give it, unlike the child routes' loaders which overlap real
// fetch waterfalls with route-chunk loading (see $entity/index.tsx, $itemId.tsx).
export const Route = createFileRoute("/_app")({
  component: EntityListLayout,
});
