import { createFileRoute } from "@tanstack/react-router";
import { ItemDetailView } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/$collection/$id")({
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { collection, id } = Route.useParams();
  return <ItemDetailView collection={collection} id={id} />;
}
