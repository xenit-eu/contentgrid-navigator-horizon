import type { ProfileEntity } from "@contentgrid/navigator-data";
import { ProfileEntitySelector } from "@contentgrid/ui";
import {
  toProfileEntityOption,
  useCreatableProfileEntities,
} from "./use-creatable-profile-entities";

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
  const { options, profileFor } = useCreatableProfileEntities();

  return (
    <div className="w-56">
      <ProfileEntitySelector
        entities={options}
        selectedEntity={toProfileEntityOption(selectedProfile)}
        size="sm"
        onSelect={(option) => {
          const profile = profileFor(option);
          if (profile) onSelect(profile);
        }}
      />
    </div>
  );
}
