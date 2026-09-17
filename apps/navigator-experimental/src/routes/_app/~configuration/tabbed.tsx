import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@contentgrid/features/layout";
import { EntityConfigurationOverviewTabbed } from "@contentgrid/features/preferences";

export const Route = createFileRoute("/_app/~configuration/tabbed")({
  component: ConfigurationOverviewTabbedPage,
});

function ConfigurationOverviewTabbedPage() {
  return (
    <PageLayout>
      {/* Card clicks jump the vertical tab list below to that entity; no navigation needed
          from here, so onSelectEntity is a no-op on this page. */}
      <EntityConfigurationOverviewTabbed onSelectEntity={() => {}} />
    </PageLayout>
  );
}
