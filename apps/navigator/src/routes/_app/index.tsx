import { createFileRoute } from "@tanstack/react-router";
import { EntityOverviewPage } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/_app/")({
  component: EntityOverviewPage,
});
