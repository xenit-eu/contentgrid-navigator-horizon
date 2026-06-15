import { useState } from "react";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { useProfile } from "./use-profile";

/** localStorage key scoped to the app identified by its profile URL hostname. */
function storageKey(profileUrl: string): string {
  try {
    return `cg.${new URL(profileUrl).hostname}.selectedProfile`;
  } catch {
    return `cg.${profileUrl}.selectedProfile`;
  }
}

export interface UseSelectedProfileResult {
  profiles: EntityInfo[];
  /** The active profile, or null while the profile list is still loading. */
  selectedProfile: EntityInfo | null;
  setSelectedProfile: (profile: EntityInfo) => void;
  isPending: boolean;
  isError: boolean;
}

export function useSelectedProfile(): UseSelectedProfileResult {
  const { profileUrl } = useNavigatorData();
  const profile = useProfile();
  const key = storageKey(profileUrl);

  const [selectedName, setSelectedName] = useState<string | null>(() => localStorage.getItem(key));

  const profiles = profile.data ?? [];
  // Fall back to the first profile when the stored name is absent or stale.
  const selectedProfile = profiles.find((p) => p.name === selectedName) ?? profiles[0] ?? null;

  function setSelectedProfile(entity: EntityInfo) {
    setSelectedName(entity.name);
    localStorage.setItem(key, entity.name);
  }

  return {
    profiles,
    selectedProfile,
    setSelectedProfile,
    isPending: profile.isPending,
    isError: profile.isError,
  };
}
