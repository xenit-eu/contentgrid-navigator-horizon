import { type ProfileEntity } from "@contentgrid/navigator-data";
import { IconBadge, type IconBadgeProps } from "@contentgrid/ui";
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../../preferences";

export interface EntityIconBadgeProps {
  readonly profile: ProfileEntity;
  readonly variant?: IconBadgeProps["variant"];
  /** Called when the badge is clicked. Omitting it renders a non-interactive badge. */
  readonly onClick?: () => void;
  /** Blends the entity's color into a soft fill instead of a solid background. */
  readonly muted?: boolean;
}

/**
 * An entity's icon badge — icon and color come from that entity's display preferences
 * (`@contentgrid/features/preferences`), so callers only decide the size and what a click
 * does.
 */
export function EntityIconBadge({
  profile,
  variant,
  onClick,
  muted = false,
}: Readonly<EntityIconBadgeProps>) {
  const { preferences } = useEntityDisplayPreferences(profile);
  const EntityIcon = resolveEntityCardIcon(preferences.icon);

  return (
    <IconBadge
      icon={<EntityIcon aria-hidden />}
      color={preferences.color}
      variant={variant}
      onClick={onClick}
      aria-label={onClick ? profile.pluralName : undefined}
      muted={muted}
    />
  );
}
