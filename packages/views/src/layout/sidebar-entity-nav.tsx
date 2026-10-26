import { BracketsSquareIcon, StackIcon } from "@phosphor-icons/react";
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
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../preferences";

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

  const { preferences } = useEntityDisplayPreferences(profile);
  const EntityIcon = resolveEntityCardIcon(preferences.icon);

  const tooltip = profile.description
    ? `${profile.pluralName}: ${profile.description}`
    : profile.pluralName;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={tooltip}
        className="gap-3"
        // Overrides the default `border-l-sidebar-primary` active-state border color with
        // the entity's chosen color. Inline style wins over the Tailwind class regardless of
        // stylesheet order. Only applied when active + a color is set — otherwise the
        // default border color (transparent when inactive, sidebar-primary when active)
        // is untouched.
        style={isActive && preferences.color ? { borderLeftColor: preferences.color } : undefined}
      >
        <Link to={"/$entity" as string} params={{ entity: profile.name } as Record<string, string>}>
          {/* Styled directly on the svg (not a wrapping span) — SidebarMenuButton's base
              classes target `>svg` and `>span:last-child` as direct children; a wrapper
              would break the `[&>svg]:size-4` sizing rule. Phosphor icons render with
              `fill="currentColor"`, so `style.color` tints the icon directly. */}
          <EntityIcon
            aria-hidden
            style={preferences.color ? { color: preferences.color } : undefined}
          />
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
