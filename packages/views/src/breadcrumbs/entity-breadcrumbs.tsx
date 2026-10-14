import { EntityItemReference } from "@contentgrid/features/entity-item";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { NavigationLink, useNavigation } from "../navigation";

export interface EntityBreadcrumbsProps {
  /** Which crumb is the page the view shows: the entity's list, or one of its items. */
  readonly page: "collection" | "item";
  /** Draws the collection crumb once known. */
  readonly profileEntity?: ProfileEntity;
  /** Draws the item crumb, as the item's reference, once loaded (`page: "item"` only). */
  readonly entityItem?: EntityItem;
}

/**
 * Home › collection › item, each crumb drawn as soon as the view knows it. The crumb for the page
 * itself is the current page; every crumb above it is a real link when the host's navigation
 * gives one (`hrefFor`), and either way a plain click goes through navigation.
 */
export function EntityBreadcrumbs({
  page,
  profileEntity,
  entityItem,
}: Readonly<EntityBreadcrumbsProps>) {
  const navigation = useNavigation();
  const { hrefFor } = navigation;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <NavigationLink href={hrefFor?.home()} onNavigate={() => navigation.openHome()}>
              Home
            </NavigationLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {profileEntity && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {page === "collection" ? (
                <BreadcrumbPage>{profileEntity.pluralName}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <NavigationLink
                    href={hrefFor?.entityItemCollection(profileEntity.name)}
                    onNavigate={() => navigation.openEntityItemCollection(profileEntity.name)}
                  >
                    {profileEntity.pluralName}
                  </NavigationLink>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {page === "item" && entityItem && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    <EntityItemReference item={entityItem} outlined />
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
