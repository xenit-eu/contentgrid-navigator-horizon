import { useMemo } from "react";
import type { EntityItemCollection, ProfileEntity } from "@contentgrid/navigator-data";
import { Button, DataTable } from "@contentgrid/ui";
import { buildColumns, buildRows, useColumnVisibility } from "../preferences";

export interface EntityItemCollectionTableProps {
  readonly profile: ProfileEntity;
  readonly collection: EntityItemCollection;
  /** Fired when a row (entity item) is clicked; receives the item id. */
  readonly onEntityItemClick?: (id: string) => void;
  /**
   * Fired when the user navigates to another page; receives the target page's
   * href (`collection.nextHref` / `collection.prevHref`). Absent = pagination
   * controls are inert.
   */
  readonly onPageChange?: (href: string | undefined) => void;
}

/**
 * Renders an entity collection as a data table plus cursor-based pagination.
 * Purely presentational: it reads the resolved `EntityItemCollection` accessor
 * and reports interactions back through callbacks — it fetches nothing itself.
 */
export function EntityItemCollectionTable({
  profile,
  collection,
  onEntityItemClick,
  onPageChange,
}: Readonly<EntityItemCollectionTableProps>) {
  const visibility = useColumnVisibility(profile);
  const columns = useMemo(() => buildColumns(profile, visibility), [profile, visibility]);
  const rows = useMemo(() => buildRows(collection.items, columns), [collection.items, columns]);

  return (
    <div className="space-y-4">
      <DataTable
        entityName={profile.name}
        entityTitle={profile.pluralName}
        columns={columns}
        rows={rows}
        onRowClick={onEntityItemClick}
      />

      {(collection.hasNext || collection.hasPrevious) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!collection.hasPrevious}
            onClick={() => onPageChange?.(collection.prevHref)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {collection.pageSize} items on this page
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!collection.hasNext}
            onClick={() => onPageChange?.(collection.nextHref)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
