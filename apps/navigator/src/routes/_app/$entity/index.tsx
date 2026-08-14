import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/_app/$entity/")({
  component: EntityDetailPage,
});
