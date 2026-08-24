import { type EntityItem, type ProfileAttribute, ProfileEntity } from "@contentgrid/navigator-data";
import { type DataTableColumn, type DataTableRow } from "@contentgrid/ui";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface ColumnVisibilityConfig {
  visibleColumns: string[];
  isVisible: (columnName: string) => boolean;
}

/**
 * Hook for determining which columns are visible in a collection view.
 *
 * Reads the merged entity display preferences (user override > backend default > heuristic
 * default — see `useEntityDisplayPreferences`) and falls back to no visible columns if
 * `visibleColumns` was never set at any layer.
 *
 * Accepts `profileEntity: undefined` (e.g. a relation's target profile that hasn't resolved
 * yet) — call this unconditionally, every render; do not skip the call when the profile is
 * still unresolved.
 *
 * @param profileEntity - The entity profile, or `undefined` if not yet resolved
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
export function useColumnVisibility(
  profileEntity: ProfileEntity | undefined,
): ColumnVisibilityConfig {
  const { preferences } = useEntityDisplayPreferences(profileEntity);
  const visibleColumns = preferences.visibleColumns ?? [];

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
 * Includes id column plus filtered user-defined attributes. Pure function — takes the
 * `ColumnVisibilityConfig` from `useColumnVisibility` as a parameter rather than calling the
 * hook itself, so it's safe to call conditionally (e.g. inside `useMemo`, or only when a
 * target profile has resolved) without violating the Rules of Hooks.
 *
 * @param profile - The entity profile
 * @param visibility - Result of `useColumnVisibility(profile)`, called by the caller
 * @returns Array of table column definitions
 */
export function buildColumns(
  profile: ProfileEntity,
  visibility: ColumnVisibilityConfig,
): DataTableColumn[] {
  const { isVisible } = visibility;

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
