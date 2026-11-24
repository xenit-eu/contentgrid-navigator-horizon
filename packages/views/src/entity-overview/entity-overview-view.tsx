import { EntityCountOverview } from "@contentgrid/features/dashboard";
import { PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";

/**
 * The home page: one card per entity; opening a card goes through the navigation context. The page
 * opens straight on the cards, so its "Home" heading is for screen readers only.
 */
export function EntityOverviewView() {
  const navigation = useViewNavigation();
  return (
    <PageLayout>
      <h1 className="sr-only">Home</h1>
      <div className="max-w-page">
        <EntityCountOverview
          onOpenEntity={(entityName) => navigation.openEntityItemCollection(entityName)}
        />
      </div>
    </PageLayout>
  );
}
