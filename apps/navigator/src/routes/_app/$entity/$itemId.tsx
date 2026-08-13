import { createFileRoute } from "@tanstack/react-router";
import {
  EntityItemDetailPage,
  ensureEntityItemDetailLoaderData,
} from "@contentgrid/features/entity-browser";
import { PageLayout } from "@contentgrid/features/layout";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) => ensureEntityItemDetailLoaderData(context, params.itemId),
  component: EntityItemDetailRoute,
});

function EntityItemDetailRoute() {
  return (
    <PageLayout>
      <EntityItemDetailPage />
    </PageLayout>
  );
}
