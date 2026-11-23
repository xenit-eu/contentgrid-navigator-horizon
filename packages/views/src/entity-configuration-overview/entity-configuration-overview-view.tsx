import { EntityConfigurationOverview } from "@contentgrid/features/preferences";
import { PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";

/**
 * The settings page (`~configuration`): one card per entity with a theme selector above them;
 * a card opens that entity's configuration through the navigation context.
 */
export function EntityConfigurationOverviewView() {
  const navigation = useViewNavigation();
  return (
    <PageLayout>
      <div className="max-w-page">
        <EntityConfigurationOverview
          onSelectEntity={(profile) => navigation.openEntityConfiguration(profile.name)}
        />
      </div>
    </PageLayout>
  );
}
