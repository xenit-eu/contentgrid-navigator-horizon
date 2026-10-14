import { createFileRoute, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemDetailView,
  preloadEntityItemDetail,
} from "@contentgrid/views/entity-item-detail";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) => preloadEntityItemDetail(context, params.entity, params.itemId),
  component: EntityItemDetailPage,
});

function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false });

  // The route params are always defined once this component actually renders (matched by the
  // file-based route below) — `strict: false` just widens the inferred type across every route.
  if (!entityName || !itemId) return <LoadingPage />;

  return <EntityItemDetailView entityName={entityName} itemId={itemId} />;
}
