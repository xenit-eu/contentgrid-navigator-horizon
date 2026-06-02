import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return <EntityList />;
}
