import { createFileRoute } from "@tanstack/react-router";
import { CollectionListView } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/$collection")({
  component: CollectionPage,
});

function CollectionPage() {
  const { collection } = Route.useParams();
  return <CollectionListView collection={collection} />;
}
