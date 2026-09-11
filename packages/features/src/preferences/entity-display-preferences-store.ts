import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EntityDisplayPreferences } from "@contentgrid/navigator-data";

/** profileUrl -> entityName -> user-set partial override, for the current backend and entity. */
type OverrideState = Record<string, Record<string, Partial<EntityDisplayPreferences>>>;

interface EntityDisplayPreferencesStore {
  overrides: OverrideState;
  /** Merge `partial` into the stored override for one entity on one backend. */
  setOverride: (
    profileUrl: string,
    entityName: string,
    partial: Partial<EntityDisplayPreferences>,
  ) => void;
  /** Remove ALL overridden fields for one entity on one backend (falls back to backend/heuristic defaults). */
  clearOverride: (profileUrl: string, entityName: string) => void;
}

/**
 * User overrides for entity display preferences (icon/color/cardStyle/nameAttribute/...),
 * the highest-priority layer of `useEntityDisplayPreferences`. Persisted to localStorage
 * under a single app-wide key — `profileUrl` is an internal map key, not a separate
 * localStorage entry per backend, so overrides for every backend a user has visited live in
 * one storage blob.
 *
 * Deliberately does NOT reuse `configStorageKey`/`appId` from `@contentgrid/navigator-data`'s
 * config module — that key defaults to `window.location.origin` (the Navigator app's own
 * origin), which is unrelated to which ContentGrid backend is being viewed.
 */
export const useEntityDisplayPreferencesStore = create<EntityDisplayPreferencesStore>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (profileUrl, entityName, partial) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [profileUrl]: {
              ...state.overrides[profileUrl],
              [entityName]: { ...state.overrides[profileUrl]?.[entityName], ...partial },
            },
          },
        })),
      clearOverride: (profileUrl, entityName) =>
        set((state) => {
          const entityOverrides = { ...state.overrides[profileUrl] };
          delete entityOverrides[entityName];
          return { overrides: { ...state.overrides, [profileUrl]: entityOverrides } };
        }),
    }),
    { name: "contentgrid-entity-display-preferences" },
  ),
);
