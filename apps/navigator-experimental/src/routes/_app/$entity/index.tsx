import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage } from "@contentgrid/features/entity-list";
import { entitySearchStateValidator } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  component: EntityDetailPage,
});
