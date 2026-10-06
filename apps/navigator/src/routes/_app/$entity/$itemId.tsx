import { createFileRoute, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { useOpenInNewTab } from "@contentgrid/features/router-shell";
import type { ViewTarget } from "@contentgrid/views";
import { EntityItemDetailView, preload } from "@contentgrid/views/entity-item-detail";

function itemTarget(entityName: string, itemId: string): ViewTarget {
  return { kind: "name", entityName, itemId };
}

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) =>
    preload(context, itemTarget(params.entity, params.itemId), undefined),
  component: EntityItemDetailPage,
});

function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false });
  const { openCreatePage } = useOpenInNewTab();

  // The route params are always defined once this component actually renders (matched by the
  // file-based route below) — `strict: false` just widens the inferred type across every route.
  if (!entityName || !itemId) return <LoadingPage />;

  return (
    <EntityItemDetailView
      target={itemTarget(entityName, itemId)}
      onRelationItemCreateNew={openCreatePage}
    />
  );
}
