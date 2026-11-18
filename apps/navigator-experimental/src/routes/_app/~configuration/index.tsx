import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EntityConfigurationOverview } from "@contentgrid/features/preferences";
import { PageLayout } from "@contentgrid/views/layout";

export const Route = createFileRoute("/_app/~configuration/")({
  component: ConfigurationOverviewPage,
});

function ConfigurationOverviewPage() {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <EntityConfigurationOverview
        onSelectEntity={(profile) =>
          navigate({ to: "/~configuration/$entity", params: { entity: profile.name } })
        }
      />
    </PageLayout>
  );
}
