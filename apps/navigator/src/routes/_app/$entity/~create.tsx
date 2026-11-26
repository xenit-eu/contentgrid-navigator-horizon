import { createFileRoute } from "@tanstack/react-router";
import { EntityItemCreateView } from "@contentgrid/views/entity-item-create";

export const Route = createFileRoute("/_app/$entity/~create")({
  component: EntityItemCreatePage,
});

function EntityItemCreatePage() {
  const { entity } = Route.useParams();
  return <EntityItemCreateView entityName={entity} />;
}
