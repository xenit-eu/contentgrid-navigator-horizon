/**
 * @contentgrid/features/preferences
 *
 * Entity display preferences: icon, color, cardStyle, nameAttribute, visibleColumns.
 * Three layers, highest priority first — user override (persisted, per-backend) > backend
 * automation default (currently stubbed, see `useEntityDisplayDefaults` in
 * `@contentgrid/navigator-data`) > heuristic default (`ProfileEntity.getDefaultPreferences()`).
 *
 * `useEntityDisplayPreferences` is the single entry point for reading and writing these
 * preferences; `useColumnVisibility` is a thin wrapper over it for the collection-view case.
 *
 * `EntityConfigurationOverview` + `EntityConfigurationDetail` (`~configuration`,
 * `~configuration/$entity`) are the entry point for users to edit these preferences — an
 * entity-card selector page plus a growing per-entity detail page. (The earlier inline
 * `~settings` page has been retired in favor of this pair.)
 */

export {
  useColumnVisibility,
  filterVisibleAttributes,
  buildColumns,
  buildRows,
} from "./use-column-visibility";
export type { ColumnVisibilityConfig } from "./use-column-visibility";
export { useEntityDisplayPreferences } from "./use-entity-display-preferences";
export type { UseEntityDisplayPreferencesResult } from "./use-entity-display-preferences";
export { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
export { resolveEntityCardIcon } from "./resolve-entity-icon";
export { EntityConfigurationOverview } from "./pages/entity-configuration-overview";
export type { EntityConfigurationOverviewProps } from "./pages/entity-configuration-overview";
export { EntityConfigurationDetail } from "./pages/entity-configuration-detail";
export type { EntityConfigurationDetailProps } from "./pages/entity-configuration-detail";
