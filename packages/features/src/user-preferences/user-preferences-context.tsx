import { type ReactNode, createContext, useContext } from "react";
import { useStore } from "zustand";
import type {
  EntityDisplayPreferencesStore,
  UserPreferencesStoreApi,
} from "./entity-display-preferences-store";

const UserPreferencesContext = createContext<UserPreferencesStoreApi | null>(null);

export interface UserPreferencesProviderProps {
  /** Created once at app startup with `createUserPreferencesStore`. */
  readonly store: UserPreferencesStoreApi;
  readonly children: ReactNode;
}

/**
 * Provides the user-preferences store to every hook in this feature. The app owns the store
 * (and so the storage behind it); tests and stories pass one backed by `createMemoryStorage()`.
 */
export function UserPreferencesProvider({ store, children }: UserPreferencesProviderProps) {
  return (
    <UserPreferencesContext.Provider value={store}>{children}</UserPreferencesContext.Provider>
  );
}

/**
 * Selector hook over the provided store. Throws outside a `<UserPreferencesProvider>`, like
 * `useViewNavigation` does outside its provider — a silent fallback store would hide that the
 * app never chose where preferences are kept.
 */
export function useEntityDisplayPreferencesStore<T>(
  selector: (state: EntityDisplayPreferencesStore) => T,
): T {
  const store = useContext(UserPreferencesContext);
  if (!store) {
    throw new Error(
      "useEntityDisplayPreferencesStore must be used inside a <UserPreferencesProvider>",
    );
  }
  return useStore(store, selector);
}
