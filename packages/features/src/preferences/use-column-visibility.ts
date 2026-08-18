import { type EntityItem, type ProfileAttribute, ProfileEntity } from "@contentgrid/navigator-data";
import { type DataTableColumn, type DataTableRow } from "@contentgrid/ui";

export interface ColumnVisibilityConfig {
  visibleColumns: string[];
  isVisible: (columnName: string) => boolean;
}

/**
 * Hook for determining which columns are visible in a collection view.
 *
 * Uses profileEntity.preferences if available, otherwise generates defaults:
 * - First 4 user-defined attributes for visibleColumns
 * - First text attribute as nameAttribute, or id if none found
 *
 * Future: will integrate with the preferences feature for user customization.
 *
 * @param profileEntity - The entity profile with optional preferences
 * @returns Column visibility configuration
 *
 * @example
 * ```typescript
 * const { visibleColumns, isVisible } = useColumnVisibility(profileEntity);
 * const visibleAttrs = profileEntity.userDefinedAttributes.filter(attr =>
 *   isVisible(attr.name)
 * );
 * ```
 */
export function useColumnVisibility(profileEntity: ProfileEntity): ColumnVisibilityConfig {
  const prefs = profileEntity.preferences ?? profileEntity.getDefaultPreferences();
  const visibleColumns = prefs.visibleColumns;

  return {
    visibleColumns,
    isVisible: (columnName: string) => visibleColumns.includes(columnName),
  };
}

/**
 * Filter attributes to only those that should be visible.
 *
 * @param attributes - Available attributes to filter
 * @param visibilityConfig - Result from useColumnVisibility
 * @returns Filtered attributes
 */
export function filterVisibleAttributes(
  attributes: readonly ProfileAttribute[],
  visibilityConfig: ColumnVisibilityConfig,
): ProfileAttribute[] {
  return attributes.filter((attr) => visibilityConfig.isVisible(attr.name));
}

/**
 * Build table columns based on profile and visibility preferences.
 *
 * Includes id column plus filtered user-defined attributes.
 *
 * @param profile - The entity profile
 * @returns Array of table column definitions
 */
export function buildColumns(profile: ProfileEntity): DataTableColumn[] {
  const { isVisible } = useColumnVisibility(profile);

  const columns: DataTableColumn[] = [];

  // Add id column if visible
  if (isVisible("id")) {
    columns.push({
      key: "id",
      header: "ID",
      sortable: true,
    });
  }

  // Add user-defined attributes
  profile.userDefinedAttributes.forEach((attr) => {
    if (isVisible(attr.name)) {
      columns.push({
        key: attr.name,
        header: attr.title ?? attr.name,
        sortable: true,
      });
    }
  });

  return columns;
}

/**
 * Build table rows from entity items and visible columns.
 *
 * @param items - Entity items to display
 * @param columns - Column definitions from buildColumns
 * @returns Array of table rows
 */
export function buildRows(
  items: readonly EntityItem[],
  columns: DataTableColumn[],
): DataTableRow[] {
  return items.map((item) => ({
    id: item.id,
    data: Object.fromEntries(columns.map((col) => [col.key, item.halItem.data[col.key] ?? ""])),
  }));
}
