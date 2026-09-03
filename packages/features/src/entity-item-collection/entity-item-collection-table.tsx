import { type ReactNode, useMemo, useState } from "react";
import { EyeIcon as Eye, TrashIcon as Trash } from "@phosphor-icons/react";
import {
  type EntityItem,
  type EntityItemCollection,
  type ProfileEntity,
  useDeleteEntityItem,
} from "@contentgrid/navigator-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  RecordDataTable,
  type RecordTableCell,
  RecordTableRow,
  type RecordTableSortOption,
} from "@contentgrid/ui";
import { AttributeValueRenderer, EntityItemReference } from "../entity-item";
import { buildColumns, useColumnVisibility } from "../preferences";

export interface EntityItemCollectionTableProps {
  readonly profile: ProfileEntity;
  readonly collection: EntityItemCollection;
  /** Fired when a row (entity item) is clicked, or the row's View action is used; receives the item. */
  readonly onEntityItemClick?: (item: EntityItem) => void;
  /**
   * Fired when the user navigates to another page; receives the target page's
   * href (`collection.nextHref` / `collection.prevHref`). Absent = pagination
   * controls are inert.
   */
  readonly onPageChange?: (href: string | undefined) => void;
  /** Currently active sort value, e.g. `"name,asc"`. */
  readonly currentSort?: string;
  /** Called with the clicked column's next sort option (or `undefined` to clear it). */
  readonly onSort?: (option: RecordTableSortOption | undefined) => void;
  /** Rendered above the table, right-aligned (e.g. a "Filters" button). */
  readonly tableActions?: ReactNode;
  /**
   * Forwarded to the underlying `RecordDataTable`'s root — pass a bounding class (e.g.
   * `"h-full"`) to opt into the pinned-header/scrollable-body layout when this table is
   * rendered inside a height-constrained parent. Omit it (as `EntityTablePreview` does, inside
   * its own `max-h-*` capped wrapper) to keep the table's default grow-to-content sizing.
   */
  readonly className?: string;
}

const REFERENCE_COLUMN_KEY = "__reference";

function toRecordTableSortOptions(profile: ProfileEntity): RecordTableSortOption[] {
  return (profile.searchTemplate?.sortOptions ?? [])
    .filter((option) => option.profileAttribute)
    .map((option) => ({
      value: option.value,
      property: option.profileAttribute!.name,
      prompt: option.prompt,
      direction: option.direction,
    }));
}

/** e.g. "Showing 20 of ~100 items" — the "~" only appears when the total is an estimate. */
function itemCountLabel(collection: EntityItemCollection): string {
  const total = collection.totalItems;
  const shown = collection.items.length;
  if (!total) return `Showing ${shown} items`;
  return `Showing ${shown} of ${total.isEstimated ? "~" : ""}${total.count.toLocaleString()} items`;
}

/**
 * Renders an entity collection as a `RecordDataTable` plus cursor-based pagination. Purely
 * presentational with respect to fetching — it reads the resolved `EntityItemCollection`
 * accessor and reports interactions back through callbacks. The one deliberate exception is
 * delete, which is self-contained: it owns its own `useDeleteEntityItem` mutation and confirm
 * dialog, gated per-row on `item.canDelete` (ABAC) rather than a caller-supplied flag.
 */
export function EntityItemCollectionTable({
  profile,
  collection,
  onEntityItemClick,
  onPageChange,
  currentSort,
  onSort,
  tableActions,
  className,
}: Readonly<EntityItemCollectionTableProps>) {
  const visibility = useColumnVisibility(profile);
  const attributeColumns = useMemo(() => buildColumns(profile, visibility), [profile, visibility]);
  const sortOptions = useMemo(() => toRecordTableSortOptions(profile), [profile]);
  const columns = useMemo(
    () => [{ key: REFERENCE_COLUMN_KEY, header: profile.singularName }, ...attributeColumns],
    [profile.singularName, attributeColumns],
  );

  const [deleteTarget, setDeleteTarget] = useState<EntityItem | null>(null);
  const deleteMutation = useDeleteEntityItem();

  return (
    <>
      <RecordDataTable
        className={className}
        entityName={profile.name}
        entityTitle={profile.pluralName}
        columns={columns}
        tableActions={tableActions}
        sortOptions={sortOptions}
        currentSort={currentSort ? [currentSort] : []}
        onSort={onSort}
        showActionsColumn
        footerContent={itemCountLabel(collection)}
        onNextPageClick={collection.hasNext ? () => onPageChange?.(collection.nextHref) : undefined}
        onPreviousPageClick={
          collection.hasPrevious ? () => onPageChange?.(collection.prevHref) : undefined
        }
      >
        {collection.items.map((item) => {
          const cells: RecordTableCell[] = [
            { key: REFERENCE_COLUMN_KEY, content: <EntityItemReference item={item} /> },
            ...attributeColumns.map((col) => {
              if (col.key === "id") {
                return { key: col.key, content: item.id };
              }
              const attr = item.findAttribute(col.key);
              return { key: col.key, content: attr ? <AttributeValueRenderer attr={attr} /> : "—" };
            }),
          ];

          return (
            <RecordTableRow
              key={item.id}
              cells={cells}
              onClick={onEntityItemClick ? () => onEntityItemClick(item) : undefined}
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEntityItemClick?.(item);
                    }}
                  >
                    <Eye className="size-4" aria-hidden />
                    <span className="sr-only">View</span>
                  </Button>
                  {item.canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(item);
                      }}
                    >
                      <Trash className="size-4" aria-hidden />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
      </RecordDataTable>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {profile.singularName.toLowerCase()}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
