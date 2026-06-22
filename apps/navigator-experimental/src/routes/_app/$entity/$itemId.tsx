import { createFileRoute } from "@tanstack/react-router";
import { EntityItemDetailPage } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  component: EntityItemDetailPage,
});
