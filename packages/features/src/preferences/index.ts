/**
 * @contentgrid/features/preferences
 *
 * Entity display preferences: icon, color, cardStyle, nameAttribute, visibleColumns,
 * searchAttributes, itemLayout.
 * Three layers, highest priority first — user override (persisted, per-backend) > backend
 * automation default (currently stubbed, see `useEntityDisplayDefaults` in
 * `@contentgrid/navigator-data`) > heuristic default (`ProfileEntity.getDefaultPreferences()`).
 *
 * `useEntityDisplayPreferences` is the single entry point for reading and writing these
 * preferences; `useColumnVisibility` is a thin wrapper over it for the collection-view case.
 *
 * The `~configuration` pages themselves are views (`@contentgrid/views/entity-configuration-*`);
 * this feature gives them their parts: `EntityConfigurationOverview` (the entity card grid with a
 * theme selector), `EntityDisplaySettingsForm` (one entity's settings), `EntityColorBadge`,
 * `EntityColorThemeSelector` and `EntityCreateFormPreview` (the create form's placeholder preview).
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
} from "./entity-configuration-overview";
export type { EntityConfigurationOverviewProps } from "./entity-configuration-overview";
export { EntityDisplaySettingsForm } from "./entity-display-settings-form";
export type { EntityDisplaySettingsFormProps } from "./entity-display-settings-form";
export { EntityColorBadge } from "./entity-color-badge";
export type { EntityColorBadgeProps } from "./entity-color-badge";
export { EntityColorThemeSelector } from "./entity-color-theme-selector";
export type { EntityColorThemeSelectorProps } from "./entity-color-theme-selector";
export { EntityCreateFormPreview } from "./entity-create-form-preview";
export type { EntityCreateFormPreviewProps } from "./entity-create-form-preview";
