import { createFileRoute } from "@tanstack/react-router";
import { EntityOverviewView } from "@contentgrid/views/entity-overview";

export const Route = createFileRoute("/_app/")({
  component: EntityOverviewView,
});
