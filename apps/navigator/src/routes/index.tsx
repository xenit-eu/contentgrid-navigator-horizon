import { createFileRoute } from "@tanstack/react-router";
import { EntityListInfiniteScrollDemo } from "@contentgrid/features/entity-list-infinite";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return <EntityListInfiniteScrollDemo />;
}
