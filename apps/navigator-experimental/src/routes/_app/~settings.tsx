import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@contentgrid/features/layout";
import { EntityDisplaySettingsPage } from "@contentgrid/features/preferences";

export const Route = createFileRoute("/_app/~settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <PageLayout>
      <EntityDisplaySettingsPage />
    </PageLayout>
  );
}
