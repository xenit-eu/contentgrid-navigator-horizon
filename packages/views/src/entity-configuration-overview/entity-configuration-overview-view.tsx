import { EntityConfigurationOverview } from "@contentgrid/features/preferences";
import { PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";

/**
 * The settings page (`~configuration`): one card per entity with a theme selector above them;
 * opening a card goes to that entity's configuration through the navigation context.
 */
export function EntityConfigurationOverviewView() {
  const navigation = useViewNavigation();
  return (
    <PageLayout>
      <EntityConfigurationOverview
        onSelectEntity={(profile) => navigation.openEntityConfiguration(profile.name)}
      />
    </PageLayout>
  );
}
