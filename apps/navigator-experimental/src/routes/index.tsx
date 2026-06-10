import { createFileRoute } from "@tanstack/react-router";
import { ExperimentalSandbox } from "@contentgrid/features/_experimental-placeholder";
import { HomeView } from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex flex-col gap-4">
      <HomeView />
      <ExperimentalSandbox />
    </div>
  );
}
