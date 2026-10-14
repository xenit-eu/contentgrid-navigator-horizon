import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemCollectionView as EntityItemCollectionFeatureView,
  type EntityItemCollectionViewProps as EntityItemCollectionFeatureViewProps,
} from "@contentgrid/features/entity-item-collection";
import { toProblemDisplayModel, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@contentgrid/ui";
import { useNavigation } from "../navigation";
import { HomeBreadcrumbItem } from "../toolbar/home-breadcrumb-item";
import { ViewPage } from "../toolbar/view-page";

export interface EntityItemCollectionViewProps extends Pick<
  EntityItemCollectionFeatureViewProps,
  "pageUrl" | "onPageChange" | "filters" | "onFiltersChange" | "currentSort" | "onSortChange"
> {
  /** Profile entity name — never the plural path. */
  readonly entityName: string;
  /** Turns off the view's own toolbar (breadcrumbs and Create action); the host then draws its own. Defaults to `true`. */
  readonly toolbar?: boolean;
}

/**
 * One entity's collection: a Home / entity-name breadcrumb, a "Create" action and the searchable,
 * filterable table. Fetches the profile itself (`useProfileEntity`) and draws its own loading/error
 * state for it; every click that opens something calls `useNavigation()`. The Create action is
 * gated on `profileEntity.createTemplate`: absent means create is not permitted, so the action is
 * not rendered.
 *
 * Until the collection view owns its state (PR 6), the host passes today's filter, sort and page
 * props and receives their change callbacks.
 */
export function EntityItemCollectionView({
  entityName,
  toolbar = true,
  ...searchProps
}: Readonly<EntityItemCollectionViewProps>) {
  const navigation = useNavigation();
  const profile = useProfileEntity({ name: entityName });

  if (!profile.data) {
    return profile.isPending ? (
      <LoadingPage />
    ) : (
      <ErrorPage
        model={toProblemDisplayModel(profile.error ?? `No entity profile named "${entityName}"`)}
      />
    );
  }

  const profileEntity = profile.data;

  return (
    <ViewPage
      hideToolbar={!toolbar}
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
            <Button variant="default" onClick={() => navigation.openCreateItem(profileEntity.name)}>
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
  );
}
