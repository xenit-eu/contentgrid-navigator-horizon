import { EntityCountOverview } from "@contentgrid/features/dashboard";
import { PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";

/** The home page: one card per entity; opening a card goes through the navigation context. */
export function EntityOverviewView() {
  const navigation = useViewNavigation();
  return (
    <PageLayout>
      <EntityCountOverview
        onOpenEntity={(entityName) => navigation.openEntityItemCollection(entityName)}
      />
    </PageLayout>
  );
}
