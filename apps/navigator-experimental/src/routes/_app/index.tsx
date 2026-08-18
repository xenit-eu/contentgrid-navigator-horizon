import { createFileRoute } from "@tanstack/react-router";
import { EntityCountOverview } from "@contentgrid/features/dashboard";
import { PageLayout } from "@contentgrid/features/layout";

export const Route = createFileRoute("/_app/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <PageLayout>
      <EntityCountOverview />
    </PageLayout>
  );
}
