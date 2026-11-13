import { useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import {
  type EntityItem,
  type ProfileEntity,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@contentgrid/ui";
import {
  EntityItemCollectionTable,
  useEntityItemCollectionSearch,
} from "../../entity-item-collection";
import { EntitySearchBar } from "../../entity-search-bar";
import { ProblemAlert } from "../../problem-details";
import type { RelationItemCreateHandler } from "./relation-handlers";

type RelationItemSelection =
  | {
      /** To-one: clicking a result links it straight away. */
      readonly multiple: false;
      readonly onSelect: (item: EntityItem) => void;
    }
  | {
      /** To-many: results get checkboxes and a "Link entity items" action. */
      readonly multiple: true;
      readonly onLinkSelected: (items: readonly EntityItem[]) => void;
    };

type RelationItemSearchProps = {
  readonly targetProfile: ProfileEntity;
  /** Shown only when `targetProfile.createTemplate` is present (create permitted). */
  readonly onCreateNew?: RelationItemCreateHandler;
  /** A link request is in flight; the caller closes the dialog once it succeeds. */
  readonly isLinking?: boolean;
  /** The failed link request's error, shown inside the dialog. */
  readonly linkError?: Error | null;
} & RelationItemSelection;

/**
 * Lists the target entity's collection to pick item(s) to link (legacy `RelationDialog`). The
 * caller closes it via `onOpenChange`, so it can stay open until the link request succeeds.
 */
export function RelationItemSearchDialog({
  open,
  onOpenChange,
  ...props
}: Readonly<RelationItemSearchProps & { open: boolean; onOpenChange: (open: boolean) => void }>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A fixed height, so the dialog stays put while searching: the results fill what the
          header, search bar and selection bar leave, and scroll inside it. */}
      <DialogContent className="flex h-[90vh] flex-col sm:max-w-6xl">
        <RelationItemSearch {...props} />
      </DialogContent>
    </Dialog>
  );
}

/** Unmounted by `DialogContent` once closed, so its search/selection state starts fresh each time. */
function RelationItemSearch(selection: Readonly<RelationItemSearchProps>) {
  const { targetProfile, onCreateNew } = selection;
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  // Dialog-local search state (not URL state): it starts fresh each time the dialog opens.
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentSort, setCurrentSort] = useState<string | undefined>(undefined);
  // Keyed by id so a selection survives paging: the table only has the current page's items.
  const [selectedItems, setSelectedItems] = useState<ReadonlyMap<string, EntityItem>>(new Map());

  const { collection, toolbarActions, filterDialog, tableProps } = useEntityItemCollectionSearch({
    profile: targetProfile,
    pageUrl,
    onPageChange: setPageUrl,
    filters,
    onFiltersChange: handleFiltersChange,
    currentSort,
    onSortChange: setCurrentSort,
  });

  // A filter change starts a new search, so the remembered page cursor no longer applies.
  function handleFiltersChange(next: Record<string, string>) {
    setFilters(next);
    setPageUrl(undefined);
  }

  function handleSelectionChange(nextIds: ReadonlySet<string>) {
    setSelectedItems((prev) => {
      const next = new Map<string, EntityItem>();
      for (const id of nextIds) {
        const item = prev.get(id) ?? collection.data?.findById(id);
        if (item) next.set(id, item);
      }
      return next;
    });
  }

  return (
    <>
      {/* `pr-6` keeps the Create button clear of the dialog's close (×) button. */}
      <DialogHeader className="flex-row items-start justify-between gap-4 pr-6 sm:text-left">
        <div>
          <DialogTitle>Link {targetProfile.pluralName}</DialogTitle>
          <DialogDescription>
            {selection.multiple ? "Select the items to link." : "Select an item to link."}
          </DialogDescription>
        </div>
        {targetProfile.createTemplate && onCreateNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onCreateNew(targetProfile.name)}
          >
            <PlusIcon className="size-4" />
            Create
          </Button>
        )}
      </DialogHeader>
      <EntitySearchBar
        profileEntity={targetProfile}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        currentSort={currentSort}
        actions={toolbarActions}
      />
      {selection.linkError && <ProblemAlert model={toProblemDisplayModel(selection.linkError)} />}
      {selection.multiple && (
        <>
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-sm font-medium">
              {selectedItems.size} item{selectedItems.size === 1 ? "" : "s"} selected
            </p>
            <Button
              type="button"
              size="sm"
              disabled={selection.isLinking || selectedItems.size === 0}
              onClick={() => selection.onLinkSelected([...selectedItems.values()])}
            >
              {selection.isLinking ? "Linking…" : "Link entity items"}
            </Button>
          </div>
        </>
      )}

      {/* `min-h-0`/`min-w-0` let this flex item shrink, so the table scrolls instead of
          overflowing the dialog. */}
      <div className="min-h-0 min-w-0 flex-1">
        {collection.isPending && <Skeleton className="h-full w-full rounded-md" />}
        {collection.isError && <ProblemAlert model={toProblemDisplayModel(collection.error)} />}
        {collection.isSuccess && (
          <EntityItemCollectionTable
            profile={targetProfile}
            collection={collection.data}
            className="h-full"
            showRowActions={false}
            onPageChange={setPageUrl}
            {...tableProps}
            {...(selection.multiple
              ? {
                  selectedIds: new Set(selectedItems.keys()),
                  onSelectionChange: handleSelectionChange,
                }
              : { onEntityItemClick: selection.isLinking ? undefined : selection.onSelect })}
          />
        )}
      </div>
      {filterDialog}
    </>
  );
}
