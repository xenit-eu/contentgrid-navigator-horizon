import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { IconBadgeOptionPickerList } from "@contentgrid/ui";
import { EntityProfileSelector, toEntityProfileOption } from "../layout";

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
  const { profiles } = useLoadedProfileEntities();
  return (
    <EntityProfileSelector
      profiles={profiles.filter((profile) => profile.createTemplate !== null)}
      selectedProfile={selectedProfile}
      onSelect={onSelect}
    />
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
      options={profiles.map((profile) => toEntityProfileOption(profile))}
      selectedOption={selectedProfile && toEntityProfileOption(selectedProfile)}
      onSelect={(option) => {
        const profile = profiles.find(({ name }) => name === option.name);
        if (profile) onSelect(profile);
      }}
      label={label}
    />
  );
}
