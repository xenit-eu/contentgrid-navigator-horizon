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
 * Currently experimental.
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
export { EntityDisplaySettingsPage } from "./entity-display-settings-page";
