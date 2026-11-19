import type { ProfileEntity } from "@contentgrid/navigator-data";
import { type IconBadgeOption, IconBadgeOptionPicker } from "@contentgrid/ui";
import { EntityIconBadge, type EntityIconBadgeProps } from "./entity-icon-badge";

/** An entity as an option of an icon-badge picker: its badge, title and description. */
export function toEntityProfileOption(
  profile: ProfileEntity,
  iconVariant?: EntityIconBadgeProps["variant"],
): IconBadgeOption {
  return {
    name: profile.name,
    title: profile.title,
    description: profile.description,
    icon: <EntityIconBadge profile={profile} variant={iconVariant} muted />,
  };
}

export interface EntityProfileSelectorProps {
  /** The entities to choose from, in the order to show them. */
  readonly profiles: readonly ProfileEntity[];
  readonly selectedProfile: ProfileEntity;
  /** Called with the entity the user picked; the caller decides what opens next. */
  readonly onSelect: (profile: ProfileEntity) => void;
}

/**
 * A compact dropdown for switching a page to another entity — e.g. in a page's toolbar, where the
 * create form and the entity configuration page draw it.
 */
export function EntityProfileSelector({
  profiles,
  selectedProfile,
  onSelect,
}: Readonly<EntityProfileSelectorProps>) {
  return (
    <div className="w-56">
      <IconBadgeOptionPicker
        options={profiles.map((profile) => toEntityProfileOption(profile, "sm"))}
        selectedOption={toEntityProfileOption(selectedProfile, "sm")}
        onSelect={(option) => {
          const profile = profiles.find(({ name }) => name === option.name);
          if (profile) onSelect(profile);
        }}
        placeholder="Select entity"
        size="sm"
      />
    </div>
  );
}
