import type { ProfileEntity } from "@contentgrid/navigator-data";
import type { ProfileEntityOption } from "@contentgrid/ui";
import { EntityIconBadge, type EntityIconBadgeProps } from "../layout";

/** The `ProfileEntitySelector` option for a `profileEntity`, with its configured icon. */
export function toProfileEntityOption(
  profile: ProfileEntity,
  iconVariant?: EntityIconBadgeProps["variant"],
): ProfileEntityOption {
  return {
    name: profile.name,
    title: profile.title,
    description: profile.description,
    icon: <EntityIconBadge profile={profile} variant={iconVariant} muted />,
  };
}
