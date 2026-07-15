import { createFileRoute } from "@tanstack/react-router";
import { EntityListLayout } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/_app")({
  component: EntityListLayout,
});
