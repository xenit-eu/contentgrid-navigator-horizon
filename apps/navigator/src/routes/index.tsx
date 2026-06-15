import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    entity: typeof search.entity === "string" ? search.entity : undefined,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { entity } = Route.useSearch();
  return <EntityList entityName={entity} />;
}
