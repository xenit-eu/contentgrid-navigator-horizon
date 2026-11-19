import { createFileRoute } from "@tanstack/react-router";
import { EntityConfigurationOverviewView } from "@contentgrid/views/entity-configuration-overview";

export const Route = createFileRoute("/_app/~configuration/")({
  component: EntityConfigurationOverviewView,
});
