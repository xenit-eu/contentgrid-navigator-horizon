import { type ReactNode, useMemo } from "react";
import { EyeIcon as Eye, TrashIcon as Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  type EntityItem,
  type EntityItemCollection,
  type ProfileEntity,
  useDeleteEntityItem,
} from "@contentgrid/navigator-data";
import {
  RecordDataTable,
  RecordRowAction,
  RecordRowConfirmAction,
  type RecordTableCell,
  type RecordTableColumn,
  RecordTableRow,
  type RecordTableSortOption,
  Skeleton,
} from "@contentgrid/ui";
import {
  AttributeValueRenderer,
  EntityItemReference,
  TABLE_ATTRIBUTE_MAX_CHAR_LENGTH,
} from "../entity-item";
import { type ColumnVisibilityConfig, buildColumns, useColumnVisibility } from "../preferences";
import { notifyProblem } from "../problem-details";
import { capitalizeFirstLetter } from "../string-utils";
import { columnTraits } from "./column-traits";
import { EntityItemRowMenu } from "./entity-item-row-menu";
import { EntityItemTitleCell } from "./entity-item-title-cell";

export interface EntityItemCollectionTableProps {
  readonly profile: ProfileEntity;
  /**
   * The page to show. Omitted while the first page loads: the header shows at once, over
   * skeleton rows in the table's shape (`look="collection"`).
   */
  readonly collection?: EntityItemCollection;
  /**
   * The rows are the previous search's, kept while the new ones load: they show dimmed.
   * `look="collection"` only.
   */
  readonly stale?: boolean;
  /** Fired when a row (entity item) is clicked, or Enter/Space is pressed on it; receives the item. */
  readonly onEntityItemClick?: (item: EntityItem) => void;
  /**
   * Fired by the default View row action (`look="default"`), or by the title link and the row
   * menu's "Open" (`look="collection"`); shown only with it; receives that row's item.
   */
  readonly onEntityItemOpen?: (item: EntityItem) => void;
  /**
   * The address of an item's own page, when the host has one. Only with `look="collection"`: each
   * row's title is then a real link (cmd/middle-click and "copy link" work); a plain click still
   * goes through `onEntityItemOpen`. Without it the title is a button when `onEntityItemOpen` is set.
   */
  readonly entityItemHref?: (item: EntityItem) => string | undefined;
  /** The item to mark as the current row, e.g. the one previewed beside the table. */
  readonly currentItem?: EntityItem;
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
   * Session-local column selection from the collection view's "Columns" picker. Overrides the
   * persisted `useColumnVisibility` result for rendering only — never written back to persisted
   * preferences. Falls back to the persisted visible columns when omitted.
   */
  readonly visibleColumnNames?: readonly string[];
  /**
   * Attribute names that must render as columns regardless of `visibleColumnNames` — e.g.
   * attributes the user is actively filtering on.
   */
  readonly forcedVisibleColumnNames?: readonly string[];
  /**
   * Forwarded to the underlying `RecordDataTable`'s root — pass a bounding class (e.g.
   * `"h-full"`) to opt into the pinned-header/scrollable-body layout when this table is
   * rendered inside a height-constrained parent. Omit it (e.g. inside a `max-h-*` capped
   * wrapper) to keep the table's default grow-to-content sizing.
   */
  readonly className?: string;
  /**
   * The table grows with its rows and the page scrolls, with the column header sticking to the
   * top of it; see `RecordDataTable`'s `pageScroll`. Leave `className` without a bounding class.
   */
  readonly pageScroll?: boolean;
  /** Ids of the selected items. The selection column renders only when `onSelectionChange` is set. */
  readonly selectedIds?: ReadonlySet<string>;
  /** Fired with the next selected-id set when a row or the header "select all" is toggled. */
  readonly onSelectionChange?: (selectedIds: ReadonlySet<string>) => void;
  /** Replaces the default per-row actions (View/Delete, or the collection look's menu), e.g. with a relation's Unlink. */
  readonly renderRowActions?: (item: EntityItem) => ReactNode;
  /**
   * `false` renders no actions column (e.g. in the relation picker), `true` always renders one.
   * By default the column shows when `renderRowActions` is given, or when the default actions
   * apply: View/Open is available or an item on the page can be deleted.
   */
  readonly showRowActions?: boolean;
  /** `false` hides the item-count/pagination footer (e.g. for an unpaginated set). Defaults to `true`. */
  readonly paginated?: boolean;
  /** `false` hides the "Showing N of M items" text, keeping the page controls. Defaults to `true`. */
  readonly showItemCount?: boolean;
  /**
   * The table's look. `"default"` is the compact table of relation sections and pickers.
   * `"collection"` is the collection page's: taller header and rows with the new sort icons and
   * tooltips, a title cell with a link and subtitle, pills and file tiles in the cells, number
   * columns right-aligned, and a "⋮" row menu instead of the View/Delete buttons.
   */
  readonly look?: "default" | "collection";
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set();
const NO_ITEMS: readonly EntityItem[] = [];

/** The platform's default page size, which the collection request doesn't override. */
const LOADING_ROW_COUNT = 20;

/** Skeleton bar widths (px) per kind of column, one per row, repeating down the page. */
const SKELETON_WIDTHS = {
  title: [120, 100, 130, 110],
  text: [140, 110, 150, 120],
  number: [60, 70, 50, 64],
  date: [80, 80, 80, 80],
} as const;

function skeletonKind(column: RecordTableColumn): keyof typeof SKELETON_WIDTHS {
  if (column.key === REFERENCE_COLUMN_KEY) return "title";
  if (column.align === "end") return "number";
  if (column.sortKind === "date") return "date";
  return "text";
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
 * the default Delete action, which owns its `useDeleteEntityItem` mutation, gated on `item.canDelete`.
 */
export function EntityItemCollectionTable({
  profile,
  collection,
  stale = false,
  onEntityItemClick,
  onEntityItemOpen,
  entityItemHref,
  currentItem,
  onPageChange,
  currentSort,
  onSort,
  tableActions,
  visibleColumnNames,
  forcedVisibleColumnNames,
  className,
  pageScroll,
  selectedIds = EMPTY_SELECTION,
  onSelectionChange,
  renderRowActions,
  showRowActions,
  paginated = true,
  showItemCount = true,
  look = "default",
}: Readonly<EntityItemCollectionTableProps>) {
  const persistedVisibility = useColumnVisibility(profile);
  // Union a session-local override and any actively-filtered attribute on top of the persisted
  // visible columns, purely for rendering — this never writes back to persisted preferences.
  // A forced-visible column (from `forcedVisibleColumnNames`) may show here even when the
  // "Columns" picker's own checkbox is unchecked, and unchecking it won't hide it while the
  // filter stays active — the union always wins. That's intentional: teaching the picker about
  // "forced" state would leak a search/filter concept into the generic attribute-selector
  // pattern for a narrow, self-correcting edge case (the column stays visible, nothing is lost).
  const effectiveVisibleColumns = useMemo(() => {
    const base = visibleColumnNames ?? persistedVisibility.visibleColumns;
    return [...new Set([...base, ...(forcedVisibleColumnNames ?? [])])];
  }, [visibleColumnNames, persistedVisibility.visibleColumns, forcedVisibleColumnNames]);
  const visibility: ColumnVisibilityConfig = useMemo(
    () => ({
      visibleColumns: effectiveVisibleColumns,
      isVisible: (name) => effectiveVisibleColumns.includes(name),
    }),
    [effectiveVisibleColumns],
  );
  const attributeColumns = useMemo(() => buildColumns(profile, visibility), [profile, visibility]);
  const sortOptions = useMemo(() => toRecordTableSortOptions(profile), [profile]);
  const isCollectionLook = look === "collection";
  const attributeColumnsWithTraits = useMemo<RecordTableColumn[]>(
    () =>
      isCollectionLook
        ? attributeColumns.map((column) => ({
            ...column,
            ...columnTraits(profile.getAttribute(column.key)),
          }))
        : attributeColumns,
    [profile, attributeColumns, isCollectionLook],
  );
  const columns = useMemo(
    () => [
      {
        key: REFERENCE_COLUMN_KEY,
        header: isCollectionLook
          ? capitalizeFirstLetter(profile.singularName)
          : profile.singularName,
      },
      ...attributeColumnsWithTraits,
    ],
    [profile.singularName, attributeColumnsWithTraits, isCollectionLook],
  );

  const items = collection?.items ?? NO_ITEMS;
  const deleteMutation = useDeleteEntityItem();

  function deleteItem(item: EntityItem) {
    deleteMutation.mutate(item, {
      onSuccess: () => {
        toast.success(
          `${capitalizeFirstLetter(profile.singularName)} has been successfully deleted!`,
        );
      },
      onError: (error) => notifyProblem(error),
    });
  }

  // Every row gets an actions node while the column shows (even an empty one), so the rows keep
  // the same grid tracks as the header.
  const hasActionsColumn =
    showRowActions ??
    (renderRowActions !== undefined ||
      onEntityItemOpen !== undefined ||
      items.some((item) => item.canDelete));

  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;
  const selectionState: boolean | "indeterminate" =
    selectedCount === 0 ? false : selectedCount === items.length ? true : "indeterminate";

  function toggleSelected(items: readonly EntityItem[], checked: boolean) {
    const next = new Set(selectedIds);
    for (const item of items) {
      if (checked) next.add(item.id);
      else next.delete(item.id);
    }
    onSelectionChange?.(next);
  }

  return (
    <>
      <RecordDataTable
        className={className}
        pageScroll={pageScroll}
        chrome={look}
        entityName={profile.name}
        entityTitle={profile.pluralName}
        columns={columns}
        tableActions={tableActions}
        sortOptions={sortOptions}
        currentSort={currentSort ? [currentSort] : []}
        onSort={onSort}
        showActionsColumn={hasActionsColumn}
        onSelectAll={onSelectionChange ? (checked) => toggleSelected(items, checked) : undefined}
        selectionState={selectionState}
        footerContent={
          collection && paginated && showItemCount ? itemCountLabel(collection) : undefined
        }
        onNextPageClick={
          collection && paginated && collection.hasNext
            ? () => onPageChange?.(collection.nextHref)
            : undefined
        }
        onPreviousPageClick={
          collection && paginated && collection.hasPrevious
            ? () => onPageChange?.(collection.prevHref)
            : undefined
        }
      >
        {!collection &&
          Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
            <RecordTableRow
              key={index}
              chrome={look}
              cells={columns.map((column) => ({
                key: column.key,
                align: column.align,
                content: (
                  <Skeleton
                    aria-hidden
                    className={`block h-3 animate-none rounded-[6px] bg-[#dfe8f0] dark:bg-border ${column.align === "end" ? "ml-auto" : ""}`}
                    style={{
                      width:
                        SKELETON_WIDTHS[skeletonKind(column)][
                          index % SKELETON_WIDTHS[skeletonKind(column)].length
                        ],
                    }}
                  />
                ),
              }))}
              actions={hasActionsColumn ? <></> : undefined}
            />
          ))}
        {items.map((item) => {
          const cells: RecordTableCell[] = [
            {
              key: REFERENCE_COLUMN_KEY,
              content: isCollectionLook ? (
                <EntityItemTitleCell
                  item={item}
                  onOpen={onEntityItemOpen}
                  href={entityItemHref?.(item)}
                />
              ) : (
                <EntityItemReference item={item} />
              ),
            },
            ...attributeColumnsWithTraits.map((col) => {
              if (col.key === "id") {
                return { key: col.key, content: item.id };
              }
              const attr = item.findAttribute(col.key);
              return {
                key: col.key,
                align: col.align,
                content: attr ? (
                  <AttributeValueRenderer
                    attr={attr}
                    variant={isCollectionLook ? "collection-table" : "table"}
                    maxCharLength={TABLE_ATTRIBUTE_MAX_CHAR_LENGTH}
                  />
                ) : (
                  "—"
                ),
              };
            }),
          ];

          return (
            <RecordTableRow
              key={item.id}
              cells={cells}
              chrome={look}
              className={stale ? "opacity-45" : undefined}
              selected={selectedIds.has(item.id)}
              current={item.id === currentItem?.id}
              onSelectChange={
                onSelectionChange ? (checked) => toggleSelected([item], checked) : undefined
              }
              onClick={
                onEntityItemClick
                  ? () => onEntityItemClick(item)
                  : onSelectionChange
                    ? () => toggleSelected([item], !selectedIds.has(item.id))
                    : undefined
              }
              actions={
                !hasActionsColumn ? undefined : renderRowActions ? (
                  renderRowActions(item)
                ) : isCollectionLook ? (
                  <EntityItemRowMenu
                    item={item}
                    onOpen={onEntityItemOpen}
                    onDelete={deleteItem}
                    deleting={deleteMutation.isPending}
                  />
                ) : (
                  <>
                    {onEntityItemOpen && (
                      <RecordRowAction
                        label="View"
                        icon={<Eye className="size-4" aria-hidden />}
                        onClick={() => onEntityItemOpen(item)}
                      />
                    )}
                    {item.canDelete && (
                      <RecordRowConfirmAction
                        label="Delete"
                        icon={<Trash className="size-4" aria-hidden />}
                        title="Delete item"
                        description={`Are you sure you want to delete this ${profile.singularName.toLowerCase()}? This action cannot be undone.`}
                        disabled={deleteMutation.isPending}
                        onConfirm={() => deleteItem(item)}
                      />
                    )}
                  </>
                )
              }
            />
          );
        })}
      </RecordDataTable>
    </>
  );
}
