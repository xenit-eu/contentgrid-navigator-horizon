import { createFileRoute } from "@tanstack/react-router";
import { EntityOverviewPage } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/_app/")({
  component: EntityOverviewPage,
});
