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
export { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
export { resolveEntityCardIcon } from "./resolve-entity-icon";
export {
  EntityConfigurationOverview,
  EntityConfigurationCard,
} from "./views/entity-configuration-overview";
export type { EntityConfigurationOverviewProps } from "./views/entity-configuration-overview";
export { EntityConfigurationOverviewTabbed } from "./views/entity-configuration-overview-tabbed";
export { EntityConfigurationDetail } from "./views/entity-configuration-detail";
export type { EntityConfigurationDetailProps } from "./views/entity-configuration-detail";
