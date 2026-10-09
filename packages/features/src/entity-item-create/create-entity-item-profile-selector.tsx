import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { EntityProfileSelector } from "./entity-profile-selector";

export interface CreateEntityItemProfileSelectorProps {
  readonly selectedProfile: ProfileEntity;
  /** Called with another creatable entity; the caller opens its create form. */
  readonly onSelect: (profile: ProfileEntity) => void;
}

/** Toolbar selector on a create form for switching to another creatable entity. */
export function CreateEntityItemProfileSelector({
  selectedProfile,
  onSelect,
}: Readonly<CreateEntityItemProfileSelectorProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const profiles = loadedProfiles.filter((profile) => profile.createTemplate !== null);

  return (
    <div className="w-56">
      <EntityProfileSelector
        profiles={profiles}
        selectedProfile={selectedProfile}
        onSelect={onSelect}
        size="sm"
      />
    </div>
  );
}
