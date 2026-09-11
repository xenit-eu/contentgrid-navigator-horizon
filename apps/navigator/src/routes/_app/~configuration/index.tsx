import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "@contentgrid/features/layout";
import { EntityConfigurationOverview } from "@contentgrid/features/preferences";

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
