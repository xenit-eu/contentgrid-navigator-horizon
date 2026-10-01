import { type ProfileEntity, useCreatableProfileEntities } from "@contentgrid/navigator-data";
import { ProfileEntitySelector } from "@contentgrid/ui";
import { toProfileEntityOption } from "./to-profile-entity-option";

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
  const { profiles } = useCreatableProfileEntities();

  return (
    <div className="w-56">
      <ProfileEntitySelector
        entities={profiles.map((profile) => toProfileEntityOption(profile, "sm"))}
        selectedEntity={toProfileEntityOption(selectedProfile, "sm")}
        size="sm"
        onSelect={(option) => {
          const profile = profiles.find(({ name }) => name === option.name);
          if (profile) onSelect(profile);
        }}
      />
    </div>
  );
}
