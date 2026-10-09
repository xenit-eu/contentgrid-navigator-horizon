import type { ProfileEntity } from "@contentgrid/navigator-data";
import {
  type IconBadgeOption,
  IconBadgeOptionPicker,
  IconBadgeOptionPickerList,
} from "@contentgrid/ui";
import { EntityIconBadge, type EntityIconBadgeProps } from "../layout";

function toOption(
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

function findProfile(profiles: readonly ProfileEntity[], option: IconBadgeOption) {
  return profiles.find(({ name }) => name === option.name);
}

export interface EntityProfileSelectorProps {
  readonly profiles: readonly ProfileEntity[];
  readonly selectedProfile?: ProfileEntity;
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly label?: string;
  /** `"sm"` for a compact placement such as a toolbar; also shrinks the icon badges. */
  readonly size?: "sm" | "default";
}

/** A dropdown of `profileEntity`s, each shown with its configured icon and description. */
export function EntityProfileSelector({
  profiles,
  selectedProfile,
  onSelect,
  label,
  size,
}: Readonly<EntityProfileSelectorProps>) {
  const iconVariant = size === "sm" ? "sm" : undefined;

  return (
    <IconBadgeOptionPicker
      options={profiles.map((profile) => toOption(profile, iconVariant))}
      selectedOption={selectedProfile && toOption(selectedProfile, iconVariant)}
      onSelect={(option) => {
        const profile = findProfile(profiles, option);
        if (profile) onSelect(profile);
      }}
      label={label}
      placeholder="Select entity"
      size={size}
    />
  );
}

export interface EntityProfileSelectorListProps {
  readonly profiles: readonly ProfileEntity[];
  readonly selectedProfile?: ProfileEntity;
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly label: string;
}

/** The `profileEntity`s as an always-visible list, each with its configured icon and description. */
export function EntityProfileSelectorList({
  profiles,
  selectedProfile,
  onSelect,
  label,
}: Readonly<EntityProfileSelectorListProps>) {
  return (
    <IconBadgeOptionPickerList
      options={profiles.map((profile) => toOption(profile))}
      selectedOption={selectedProfile && toOption(selectedProfile)}
      onSelect={(option) => {
        const profile = findProfile(profiles, option);
        if (profile) onSelect(profile);
      }}
      label={label}
    />
  );
}
