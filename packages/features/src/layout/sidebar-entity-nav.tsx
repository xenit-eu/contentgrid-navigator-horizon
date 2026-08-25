import { BracketsSquareIcon, DatabaseIcon, FileTextIcon, StackIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ProfileEntity, useCachedEntityItemCollection } from "@contentgrid/navigator-data";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@contentgrid/ui";

interface SidebarEntityNavProps {
  readonly profiles: readonly ProfileEntity[];
  readonly isLoading: boolean;
  /** The `name` of the profile whose collection page is currently active. */
  readonly activeEntity: string | undefined;
}

/**
 * "Entities" sidebar group: one row per discovered profile, showing an icon,
 * the plural name, and — once available — an item count. The count is never
 * fetched from here; see `SidebarEntityNavItem`.
 */
export function SidebarEntityNav({ profiles, isLoading, activeEntity }: SidebarEntityNavProps) {
  return (
    <SidebarGroup className="pt-0">
      <SidebarGroupLabel icon={<StackIcon aria-hidden />}>Entities</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading
            ? [1, 2, 3].map((i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))
            : profiles.map((profile) => (
                <SidebarEntityNavItem
                  key={profile.name}
                  profile={profile}
                  isActive={activeEntity === profile.name}
                />
              ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SidebarEntityNavItem({
  profile,
  isActive,
}: {
  readonly profile: ProfileEntity;
  readonly isActive: boolean;
}) {
  // Read-only: shows a count only if some other query already cached it
  // (e.g. the user previously opened this entity's collection page). Never
  // fetches on its own, so mounting the sidebar never fires one collection
  // request per entity.
  const { data: collection } = useCachedEntityItemCollection(profile);
  const total = collection?.totalItems;

  const tooltip = profile.description
    ? `${profile.pluralName}: ${profile.description}`
    : profile.pluralName;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={tooltip} className="gap-3">
        <Link to={"/$entity" as string} params={{ entity: profile.name } as Record<string, string>}>
          {profile.hasContentAttributes ? (
            <FileTextIcon aria-hidden />
          ) : (
            <DatabaseIcon aria-hidden />
          )}
          <span>{profile.pluralName}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuBadge className="text-sidebar-foreground/50">
        {total !== undefined ? (
          <>
            {total.isEstimated ? "~" : ""}
            {total.count}
          </>
        ) : (
          <BracketsSquareIcon />
        )}
      </SidebarMenuBadge>
    </SidebarMenuItem>
  );
}
