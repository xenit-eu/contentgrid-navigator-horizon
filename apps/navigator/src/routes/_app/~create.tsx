import { createFileRoute } from "@tanstack/react-router";
import { ClassifyCreateEntityItemView } from "@contentgrid/views/classify-create-entity-item";

export const Route = createFileRoute("/_app/~create")({
  component: ClassifyCreateEntityItemView,
});
