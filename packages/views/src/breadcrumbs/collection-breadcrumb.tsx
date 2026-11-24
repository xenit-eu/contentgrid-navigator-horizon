import type { ReactNode } from "react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { NavigationLink, useViewNavigation } from "../navigation";

/**
 * The entity's collection — its plural name as plain text — followed by its `children` crumbs:
 * a link to the list when crumbs follow it, the current page when it is last. Draws nothing (nor its children) until the profile is known.
 */
export function CollectionBreadcrumb({
  profileEntity,
  children,
}: Readonly<{ profileEntity: ProfileEntity | undefined; children?: ReactNode }>) {
  const navigation = useViewNavigation();
  if (!profileEntity) return null;

  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        {children ? (
          <BreadcrumbLink asChild>
            <NavigationLink
              href={navigation.hrefFor?.entityItemCollection(profileEntity.name)}
              onNavigate={() => navigation.openEntityItemCollection(profileEntity.name)}
            >
              {profileEntity.pluralName}
            </NavigationLink>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage>{profileEntity.pluralName}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {children}
    </>
  );
}
