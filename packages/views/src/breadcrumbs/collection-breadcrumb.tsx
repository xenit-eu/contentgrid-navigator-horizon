import type { ReactNode } from "react";
import { EntityIconBadge } from "@contentgrid/features/layout";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  TruncatedText,
} from "@contentgrid/ui";
import { NavigationLink, useViewNavigation } from "../navigation";

/** Characters of a crumb's title before it is truncated with "…"; the full title shows on hover. */
export const BREADCRUMB_TITLE_MAX_CHAR_LENGTH = 40;

/**
 * The entity's collection — its icon badge and plural name — followed by its `children` crumbs:
 * a link to the list (outlined badge) when crumbs follow it, the current page (solid badge) when
 * it is last. A long name is truncated, with the full name on hover. Draws nothing (nor its children)
 * until the profile is known.
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
              className="inline-flex items-center gap-2"
            >
              <EntityIconBadge profile={profileEntity} variant="sm" outlined />
              <TruncatedText
                text={profileEntity.pluralName}
                maxCharLength={BREADCRUMB_TITLE_MAX_CHAR_LENGTH}
              />
            </NavigationLink>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage className="inline-flex items-center gap-2">
            <EntityIconBadge profile={profileEntity} variant="sm" />
            <TruncatedText
              text={profileEntity.pluralName}
              maxCharLength={BREADCRUMB_TITLE_MAX_CHAR_LENGTH}
            />
          </BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {children}
    </>
  );
}
