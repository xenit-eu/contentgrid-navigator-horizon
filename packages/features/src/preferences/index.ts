/**
 * @contentgrid/features/preferences
 *
 * Preferences management feature for customizing entity views and other user preferences.
 *
 * This feature will provide:
 * - Column visibility preferences per entity type
 * - User preference storage and retrieval
 * - Synchronization with backend preferences endpoint
 *
 * Currently experimental - used by entity-item-collection for column visibility.
 */

export {
  useColumnVisibility,
  filterVisibleAttributes,
  buildColumns,
  buildRows,
} from "./use-column-visibility";
export type { ColumnVisibilityConfig } from "./use-column-visibility";
