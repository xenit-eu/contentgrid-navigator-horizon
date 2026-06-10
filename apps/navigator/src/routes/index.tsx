import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return <HomeView />;
}
