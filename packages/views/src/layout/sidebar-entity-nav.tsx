import { StackIcon } from "@phosphor-icons/react";
import {
  resolveEntityCardIcon,
  useEntityDisplayPreferences,
} from "@contentgrid/features/preferences";
import { type ProfileEntity, useEntityItemCollection } from "@contentgrid/navigator-data";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
  Skeleton,
  formatCount,
} from "@contentgrid/ui";
import { handleNavigationClick } from "../navigation";

interface SidebarEntityNavProps {
  readonly profiles: readonly ProfileEntity[];
  readonly isLoading: boolean;
  /** The `name` of the profile whose collection page is currently active. */
  readonly activeEntity: string | undefined;
  /** Called when the user opens an entity's collection. */
  readonly onOpenEntity: (entityName: string) => void;
  /** The real address of an entity's collection, when the host has one (renders an `<a href>`). */
  readonly entityHref?: (entityName: string) => string;
}

/** Widths of the three placeholder bars while the entity list loads. */
const LOADING_BAR_WIDTHS = ["70%", "55%", "64%"] as const;

/**
 * "Entities" sidebar group: one row per discovered profile, showing an icon,
 * the plural name and its item count. Every row loads its own count (see
 * `SidebarEntityNavItem`).
 */
export function SidebarEntityNav({
  profiles,
  isLoading,
  activeEntity,
  onOpenEntity,
  entityHref,
}: SidebarEntityNavProps) {
  return (
    <SidebarGroup className="pt-0">
      {/* Collapsed: a 1px divider between the top actions and the entity icons. */}
      <SidebarSeparator className="mx-auto my-1 hidden w-7 group-data-[collapsible=icon]:block" />
      <SidebarGroupLabel icon={<StackIcon aria-hidden />}>Entities</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading
            ? LOADING_BAR_WIDTHS.map((width) => (
                <SidebarMenuItem key={width}>
                  <SidebarMenuSkeleton width={width} />
                </SidebarMenuItem>
              ))
            : profiles.map((profile) => (
                <SidebarEntityNavItem
                  key={profile.name}
                  profile={profile}
                  isActive={activeEntity === profile.name}
                  onOpen={() => onOpenEntity(profile.name)}
                  href={entityHref?.(profile.name)}
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
  onOpen,
  href,
}: {
  readonly profile: ProfileEntity;
  readonly isActive: boolean;
  readonly onOpen: () => void;
  readonly href: string | undefined;
}) {
  // The same query Home's cards run (same key, same options), so the count is fetched once per
  // entity and shared through the cache: opening Home after the sidebar, or the other way round,
  // costs no second request.
  const { data: collection, isLoading: isLoadingCount } = useEntityItemCollection(
    { profileEntity: profile },
    { queryOptionsOverride: { refetchOnWindowFocus: false, refetchOnMount: false } },
  );
  const count = formatCount(collection?.totalItems);

  const { preferences } = useEntityDisplayPreferences(profile);
  const EntityIcon = resolveEntityCardIcon(preferences.icon);

  const tooltip = profile.description
    ? `${profile.pluralName}: ${profile.description}`
    : profile.pluralName;

  const entityContent = (
    <>
      {/* Styled directly on the svg (not a wrapping span) — SidebarMenuButton's base
              classes target `>svg` and `>span:last-child` as direct children; a wrapper
              would break the `[&>svg]:size-4` sizing rule. Phosphor icons render with
              `fill="currentColor"`, so `style.color` tints the icon directly. */}
      <EntityIcon
        aria-hidden
        style={preferences.color ? { color: preferences.color } : undefined}
      />
      <span>{profile.pluralName}</span>
    </>
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={href !== undefined}
        onClick={href === undefined ? onOpen : undefined}
        isActive={isActive}
        tooltip={tooltip}
      >
        {href === undefined ? (
          entityContent
        ) : (
          <a href={href} onClick={(event) => handleNavigationClick(event, onOpen)}>
            {entityContent}
          </a>
        )}
      </SidebarMenuButton>
      {/* Unknown or not allowed: nothing, no placeholder. */}
      {isLoadingCount ? (
        <SidebarMenuBadge aria-hidden>
          <Skeleton className="h-2.5 w-6.5 rounded-full" />
        </SidebarMenuBadge>
      ) : (
        count !== undefined && <SidebarMenuBadge>{count}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
