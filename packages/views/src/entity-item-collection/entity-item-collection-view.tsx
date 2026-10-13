import {
  EntityItemCollectionView as EntityItemCollectionFeatureView,
  type EntityItemCollectionViewProps as EntityItemCollectionFeatureViewProps,
} from "@contentgrid/features/entity-item-collection";
import { useViewTarget } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@contentgrid/ui";
import { ViewTargetGate } from "../gate/view-target-gate";
import { useNavigation } from "../navigation";
import { HomeBreadcrumbItem } from "../toolbar/home-breadcrumb-item";
import { ViewPage } from "../toolbar/view-page";
import type { ViewProps } from "../types";

export interface EntityItemCollectionViewProps
  extends
    ViewProps,
    Pick<
      EntityItemCollectionFeatureViewProps,
      "pageUrl" | "onPageChange" | "filters" | "onFiltersChange" | "currentSort" | "onSortChange"
    > {
  /** Turns off the view's own toolbar (breadcrumbs and Create action); the host draws its own. */
  readonly hideToolbar?: boolean;
}

/**
 * One entity's collection: a Home / entity-name breadcrumb, a "Create" action and the searchable,
 * filterable table. Takes a `ViewTarget` (a name without an item id, or a collection link) and
 * resolves it through `useViewTarget`; every click that opens something calls `useNavigation()`.
 * The Create action is gated on `profileEntity.createTemplate`: absent means create is not
 * permitted, so the action is not rendered.
 *
 * Until the collection view owns its state (PR 6), the host passes today's filter, sort and page
 * props and receives their change callbacks.
 */
export function EntityItemCollectionView({
  target,
  hideToolbar = false,
  ...searchProps
}: Readonly<EntityItemCollectionViewProps>) {
  const navigation = useNavigation();
  const result = useViewTarget(target);

  return (
    <ViewTargetGate result={result}>
      {({ profileEntity }) => (
        <ViewPage
          hideToolbar={hideToolbar}
          breadcrumbs={
            <Breadcrumb>
              <BreadcrumbList>
                <HomeBreadcrumbItem />
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{profileEntity.pluralName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            profileEntity.createTemplate && (
              <div>
                <Button
                  variant="default"
                  onClick={() => navigation.openCreateItem(profileEntity.name)}
                >
                  Create {profileEntity.singularName}
                </Button>
              </div>
            )
          }
        >
          <EntityItemCollectionFeatureView
            {...searchProps}
            profile={profileEntity}
            onEntityItemClick={(item) => navigation.openItem(profileEntity.name, item.id)}
          />
        </ViewPage>
      )}
    </ViewTargetGate>
  );
}
