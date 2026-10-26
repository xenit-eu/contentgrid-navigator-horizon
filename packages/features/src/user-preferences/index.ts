/**
 * @contentgrid/features/user-preferences
 *
 * Entity display preferences: icon, color, cardStyle, nameAttribute, visibleColumns,
 * searchAttributes.
 * Three layers, highest priority first — user override (persisted, per-backend) > backend
 * automation default (currently stubbed, see `useEntityDisplayDefaults` in
 * `@contentgrid/navigator-data`) > heuristic default (`ProfileEntity.getDefaultPreferences()`).
 *
 * `useEntityDisplayPreferences` is the single entry point for reading and writing these
 * preferences; `useColumnVisibility` is a thin wrapper over it for the collection-view case.
 *
 * The store is created by the app at startup (`createUserPreferencesStore`, `localStorage` by
 * default) and provided with `UserPreferencesProvider`; the hooks throw without one.
 *
 * `EntityConfigurationOverview` + `EntityConfigurationDetail` (`~configuration`,
 * `~configuration/$entity`) are the entry point for users to edit these preferences — an
 * entity-card selector page plus a growing per-entity detail page. (The earlier inline
 * `~settings` page has been retired in favor of this pair.)
 *
 * `EntityConfigurationOverviewTabbed` is an alternate layout for the same page: the same
 * card grid, plus a vertical tab list beneath it that renders `EntityConfigurationDetail`
 * inline instead of navigating to `~configuration/$entity`.
 */

export {
  useColumnVisibility,
  filterVisibleAttributes,
  buildColumns,
} from "./use-column-visibility";
export type { ColumnVisibilityConfig } from "./use-column-visibility";
export { toAttributeOption } from "./attribute-options";
export { useEntityDisplayPreferences } from "./use-entity-display-preferences";
export type { UseEntityDisplayPreferencesResult } from "./use-entity-display-preferences";
export {
  createUserPreferencesStore,
  createMemoryStorage,
  USER_PREFERENCES_STORAGE_KEY,
} from "./entity-display-preferences-store";
export type {
  CreateUserPreferencesStoreOptions,
  UserPreferencesStoreApi,
} from "./entity-display-preferences-store";
export { UserPreferencesProvider } from "./user-preferences-context";
export type { UserPreferencesProviderProps } from "./user-preferences-context";
export { resolveEntityCardIcon } from "./resolve-entity-icon";
export {
  EntityConfigurationOverview,
  EntityConfigurationCard,
} from "./configuration/entity-configuration-overview";
export type { EntityConfigurationOverviewProps } from "./configuration/entity-configuration-overview";
export { EntityConfigurationOverviewTabbed } from "./configuration/entity-configuration-overview-tabbed";
export { EntityConfigurationDetail } from "./configuration/entity-configuration-detail";
export type { EntityConfigurationDetailProps } from "./configuration/entity-configuration-detail";
