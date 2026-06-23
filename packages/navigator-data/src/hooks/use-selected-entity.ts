import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type ProfileEntity from "../accessors/entity-profile";
import { profileRootQuery } from "../accessors/entity-profile";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

function storageKey(profileUrl: string): string {
  try {
    return `cg.${new URL(profileUrl).hostname}.selectedEntity`;
  } catch {
    return `cg.${profileUrl}.selectedEntity`;
  }
}

export interface UseSelectedEntityResult {
  entities: ProfileEntity[];
  /** The active entity, or null while the entity list is still loading. */
  selectedEntity: ProfileEntity | null;
  setSelectedEntity: (entity: ProfileEntity) => void;
  isPending: boolean;
  isError: boolean;
}

export function useSelectedEntity(): UseSelectedEntityResult {
  const { apiFetch, profileUrl } = useNavigatorData();
  const { isPending: isRootPending, isError: isRootError } = useQuery(
    profileRootQuery(apiFetch, profileUrl),
  );
  const profileResults = useProfileEntities();
  const key = storageKey(profileUrl);

  const [selectedName, setSelectedName] = useState<string | null>(() => localStorage.getItem(key));

  const entities = profileResults.filter((r) => r.data).map((r) => r.data!);
  const isPending = isRootPending || profileResults.some((r) => r.isPending);
  const isError = isRootError || profileResults.some((r) => r.isError);

  // Fall back to the first entity when the stored name is absent or stale.
  const selectedEntity = entities.find((e) => e.name === selectedName) ?? entities[0] ?? null;

  function setSelectedEntity(entity: ProfileEntity) {
    setSelectedName(entity.name);
    localStorage.setItem(key, entity.name);
  }

  return {
    entities,
    selectedEntity,
    setSelectedEntity,
    isPending,
    isError,
  };
}
