import { createFileRoute } from "@tanstack/react-router";
import { CollectionListView } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/$collection/")({
  component: CollectionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    cursor: typeof search.cursor === "string" ? search.cursor : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
});

function CollectionPage() {
  const { collection } = Route.useParams();
  const { cursor, sort } = Route.useSearch();
  return <CollectionListView collection={collection} cursor={cursor} sort={sort} />;
}
