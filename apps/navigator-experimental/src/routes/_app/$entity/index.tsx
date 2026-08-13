import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@contentgrid/features/layout";
import { entitySearchStateValidator } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  component: EntityDetailRoute,
});

function EntityDetailRoute() {
  return (
    <PageLayout>
      <EntityDetailPage />
    </PageLayout>
  );
}
