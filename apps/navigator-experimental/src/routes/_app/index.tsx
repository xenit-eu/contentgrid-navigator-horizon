import { createFileRoute } from "@tanstack/react-router";
import { ExperimentalSandbox } from "@contentgrid/features/_experimental-placeholder";
import { EntityOverviewPage } from "@contentgrid/features/entity-browser";
import { PageLayout } from "@contentgrid/features/layout";
import { RecentlyCreatedList } from "@contentgrid/features/recently-created";
import { useProfileEntities } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <PageLayout>
      <div className="space-y-8">
        <EntityOverviewPage />
        <RecentlyCreatedSection />
        <ExperimentalSandbox />
      </div>
    </PageLayout>
  );
}

function RecentlyCreatedSection() {
  const profiles = useProfileEntities();

  return (
    <>
      {profiles.map(
        (result) =>
          result.data?.createdAtAttribute && (
            <RecentlyCreatedList key={result.data.name} profileEntity={result.data} />
          ),
      )}
    </>
  );
}
