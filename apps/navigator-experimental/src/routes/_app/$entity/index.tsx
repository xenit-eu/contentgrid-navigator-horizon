import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage, entityDetailSearchValidator } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entityDetailSearchValidator,
  component: EntityDetailPage,
});
