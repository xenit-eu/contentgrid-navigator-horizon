import { useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import {
  type EntityItem,
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
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
import { EntityItemCollectionTable } from "../../entity-item-collection";
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
      <DialogContent>{open && <RelationItemSearch {...props} />}</DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so its search/selection state starts fresh each time. */
function RelationItemSearch(selection: Readonly<RelationItemSearchProps>) {
  const { targetProfile, onCreateNew } = selection;
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  // Keyed by id so a selection survives paging: the table only has the current page's items.
  const [selectedItems, setSelectedItems] = useState<ReadonlyMap<string, EntityItem>>(new Map());

  const collection = useEntityItemCollection(
    pageUrl !== undefined
      ? { url: pageUrl, profileEntity: targetProfile }
      : { profileEntity: targetProfile },
  );

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
      {collection.isPending && <Skeleton className="h-40 w-full rounded-md" />}
      {collection.isError && <ProblemAlert model={toProblemDisplayModel(collection.error)} />}
      {collection.isSuccess && (
        // `min-w-0` lets this grid item shrink so the table scrolls instead of overflowing.
        <div className="min-w-0">
          <EntityItemCollectionTable
            profile={targetProfile}
            collection={collection.data}
            className="max-h-80"
            showRowActions={false}
            showItemCount={false}
            onPageChange={setPageUrl}
            {...(selection.multiple
              ? {
                  selectedIds: new Set(selectedItems.keys()),
                  onSelectionChange: handleSelectionChange,
                }
              : { onEntityItemClick: selection.isLinking ? undefined : selection.onSelect })}
          />
        </div>
      )}
    </>
  );
}
