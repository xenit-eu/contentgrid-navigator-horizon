import { createFileRoute } from "@tanstack/react-router";
import { EntityConfigurationDetailView } from "@contentgrid/views/entity-configuration-detail";

export const Route = createFileRoute("/_app/~configuration/$entity/")({
  component: ConfigurationDetailPage,
});

function ConfigurationDetailPage() {
  const { entity } = Route.useParams();
  return <EntityConfigurationDetailView entityName={entity} />;
}
