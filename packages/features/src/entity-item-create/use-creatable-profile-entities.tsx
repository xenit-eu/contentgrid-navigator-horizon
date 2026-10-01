import { useMemo } from "react";
import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import type { ProfileEntityOption } from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";

interface CreatableProfileEntities {
  /** Entities with a create form, in sidebar order. */
  readonly options: readonly ProfileEntityOption[];
  readonly isLoading: boolean;
  readonly profileFor: (option: ProfileEntityOption) => ProfileEntity | undefined;
}

export function toProfileEntityOption(profile: ProfileEntity): ProfileEntityOption {
  return {
    name: profile.name,
    title: profile.title,
    description: profile.description,
    icon: <EntityIconBadge profile={profile} variant="sm" muted />,
  };
}

/** The entities the current user may create (a `createTemplate` is present), as selector options. */
export function useCreatableProfileEntities(): CreatableProfileEntities {
  const { profiles: loadedProfiles, isLoading } = useLoadedProfileEntities();

  return useMemo(() => {
    const profiles = loadedProfiles.filter((profile) => profile.createTemplate !== null);
    return {
      options: profiles.map(toProfileEntityOption),
      isLoading,
      profileFor: (option) => profiles.find((profile) => profile.name === option.name),
    };
  }, [loadedProfiles, isLoading]);
}
