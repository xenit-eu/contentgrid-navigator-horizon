import { createFileRoute } from "@tanstack/react-router";
import { EntityListLayout } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/_app")({
  component: EntityListLayout,
});
