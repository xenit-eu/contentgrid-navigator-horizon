import { createFileRoute } from "@tanstack/react-router";
import { ExperimentalSandbox } from "@contentgrid/features/_experimental-placeholder";
import { EntityList } from "@contentgrid/features/entity-list";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <EntityList />
      <ExperimentalSandbox />
    </div>
  );
}
