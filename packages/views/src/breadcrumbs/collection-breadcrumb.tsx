import type { ReactNode } from "react";
import { EntityIconBadge } from "@contentgrid/features/layout";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { NavigationLink, useNavigation } from "../navigation";

/**
 * The entity's collection — its icon badge and plural name — followed by its `children` crumbs:
 * a link to the list (outlined badge) when crumbs follow it, the current page (solid badge) when
 * it is last. Draws nothing (nor its children) until the profile is known.
 */
export function CollectionBreadcrumb({
  profileEntity,
  children,
}: Readonly<{ profileEntity: ProfileEntity | undefined; children?: ReactNode }>) {
  const navigation = useNavigation();
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
              className="inline-flex items-center gap-2"
            >
              <EntityIconBadge profile={profileEntity} variant="sm" outlined />
              {profileEntity.pluralName}
            </NavigationLink>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage className="inline-flex items-center gap-2">
            <EntityIconBadge profile={profileEntity} variant="sm" />
            {profileEntity.pluralName}
          </BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {children}
    </>
  );
}
