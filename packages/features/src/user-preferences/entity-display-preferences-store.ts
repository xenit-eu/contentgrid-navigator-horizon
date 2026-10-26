import { type StoreApi, createStore } from "zustand";
import { type StateStorage, createJSONStorage, persist } from "zustand/middleware";
import type { EntityDisplayPreferences } from "@contentgrid/navigator-data";

/** profileUrl -> entityName -> user-set partial override, for the current backend and entity. */
type OverrideState = Record<string, Record<string, Partial<EntityDisplayPreferences>>>;

export interface EntityDisplayPreferencesStore {
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

/** The persisted key. Unchanged since the store was a module singleton, so earlier user choices still load. */
export const USER_PREFERENCES_STORAGE_KEY = "contentgrid-entity-display-preferences";

export type UserPreferencesStoreApi = StoreApi<EntityDisplayPreferencesStore>;

export interface CreateUserPreferencesStoreOptions {
  /** Where overrides are persisted. Defaults to `localStorage`; tests and stories pass `createMemoryStorage()`. */
  readonly storage?: StateStorage;
}

/** A non-persistent `StateStorage`, for tests and stories. */
export function createMemoryStorage(initial: Record<string, string> = {}): StateStorage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (name) => items.get(name) ?? null,
    setItem: (name, value) => void items.set(name, value),
    removeItem: (name) => void items.delete(name),
  };
}

/**
 * Creates the store of user overrides for entity display preferences (icon/color/cardStyle/
 * nameAttribute/...), the highest-priority layer of `useEntityDisplayPreferences`. The app
 * creates one at startup and provides it through `UserPreferencesProvider`.
 *
 * Persisted under a single app-wide key — `profileUrl` is an internal map key, not a separate
 * storage entry per backend, so overrides for every backend a user has visited live in
 * one storage blob.
 *
 * Deliberately does NOT reuse `configStorageKey`/`appId` from `@contentgrid/navigator-data`'s
 * config module — that key defaults to `window.location.origin` (the Navigator app's own
 * origin), which is unrelated to which ContentGrid backend is being viewed.
 */
export function createUserPreferencesStore(
  options: CreateUserPreferencesStoreOptions = {},
): UserPreferencesStoreApi {
  const { storage } = options;
  return createStore<EntityDisplayPreferencesStore>()(
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
      {
        name: USER_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage(() => storage ?? localStorage),
      },
    ),
  );
}
