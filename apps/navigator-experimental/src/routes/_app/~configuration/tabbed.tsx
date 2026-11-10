import { createFileRoute } from "@tanstack/react-router";
import { EntityConfigurationOverviewTabbed } from "@contentgrid/features/preferences";
import { PageLayout } from "@contentgrid/views/layout";

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
