import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";
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

export interface CreateEntityItemProfileSelectorProps {
  readonly selectedProfile: ProfileEntity;
  /** Called with another creatable entity; the caller opens its create form. */
  readonly onSelect: (profile: ProfileEntity) => void;
}

/** Toolbar dropdown on a create form for switching to another creatable entity. */
export function CreateEntityItemProfileSelector({
  selectedProfile,
  onSelect,
}: Readonly<CreateEntityItemProfileSelectorProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const profiles = loadedProfiles.filter((profile) => profile.createTemplate !== null);

  return (
    <div className="w-56">
      <IconBadgeOptionPicker
        options={profiles.map((profile) => toOption(profile, "sm"))}
        selectedOption={toOption(selectedProfile, "sm")}
        onSelect={(option) => {
          const profile = findProfile(profiles, option);
          if (profile) onSelect(profile);
        }}
        placeholder="Select entity"
        size="sm"
      />
    </div>
  );
}

interface CreateEntityItemProfileSelectorListProps {
  /** The creatable entities, in the order to show them. */
  readonly profiles: readonly ProfileEntity[];
  readonly selectedProfile?: ProfileEntity;
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly label: string;
}

/** The creatable entities as an always-visible list, for choosing which one to create. */
export function CreateEntityItemProfileSelectorList({
  profiles,
  selectedProfile,
  onSelect,
  label,
}: Readonly<CreateEntityItemProfileSelectorListProps>) {
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
