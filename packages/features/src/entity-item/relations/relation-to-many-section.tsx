import { useEffect, useMemo, useRef, useState } from "react";
import { LinkBreakIcon as LinkBreak, PlusIcon } from "@phosphor-icons/react";
import {
  type EntityItemToManyRelation,
  type ProfileEntity,
  toProblemDisplayModel,
  useAddToManyRelation,
  useClearRelation,
  useDeleteRelationItem,
  useEntityItemToManyRelation,
  useUnlinkRelation,
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
  CountIndicatorChip,
  DataTable,
  RelationAccordion,
  Skeleton,
} from "@contentgrid/ui";
import { EntityItemCountLabel } from "../../entity-item-collection";
import { buildColumns, buildRows, useColumnVisibility } from "../../preferences";
import { ProblemAlert } from "../../problem-details";
import {
  MutationErrorDisplay,
  type MutationErrorDisplayProps,
  type RelationItemClickHandler,
  type RelationItemCreateHandler,
  RelationItemSearchDialog,
  resolveNewlyLinkedHrefs,
} from "./relation-shared";

export function RelationToManySection({
  relation,
  profiles,
  onItemClick,
  onCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<{
  relation: EntityItemToManyRelation;
  profiles: readonly ProfileEntity[];
  onItemClick?: RelationItemClickHandler;
  onCreateNew?: RelationItemCreateHandler;
}> &
  Pick<
    MutationErrorDisplayProps,
    "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
  >) {
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  const collection = useEntityItemToManyRelation(relation, pageUrl ? { url: pageUrl } : undefined);
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation, {
    mutationOptions: { onSuccess: () => setPageUrl(undefined) },
  });
  const {
    mutate: addRelation,
    isPending: isAdding,
    error: addError,
  } = useAddToManyRelation(relation);
  const {
    mutate: unlinkItem,
    isPending: isUnlinking,
    error: unlinkError,
  } = useUnlinkRelation(relation);
  const {
    mutate: deleteItem,
    isPending: isDeleting,
    error: deleteError,
  } = useDeleteRelationItem(relation);
  const mutationError = clearError ?? addError ?? unlinkError ?? deleteError;
  const [addOpen, setAddOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(true);
  const targetProfile = relation.profileRelation.getTargetProfile(profiles);
  const title = relation.profileRelation.title ?? relation.name;

  // Starts expanded (loading/error states stay visible, same as before) and auto-collapses once,
  // the first time the relation's collection resolves as genuinely empty — so an empty relation
  // renders as a collapsed row instead of an expanded card with nothing in it but "No items
  // linked". The ref guards this to a one-time nudge: it must not re-collapse a section the user
  // has since expanded on purpose, or fight a `setAccordionOpen(true)` from linking (below).
  const hasAutoCollapsed = useRef(false);
  useEffect(() => {
    if (!hasAutoCollapsed.current && collection.isSuccess && collection.data.isEmpty) {
      hasAutoCollapsed.current = true;
      setAccordionOpen(false);
    }
  }, [collection.isSuccess, collection.data]);

  const visibility = useColumnVisibility(targetProfile);
  const columns = useMemo(
    () => (targetProfile ? buildColumns(targetProfile, visibility) : [{ key: "id", header: "ID" }]),
    [targetProfile, visibility],
  );
  const rows = useMemo(
    () => (collection.isSuccess ? buildRows(collection.data.items, columns) : []),
    [collection.isSuccess, collection.data, columns],
  );
  const total = collection.isSuccess ? collection.data.totalItems : undefined;
  const canUnlinkAll =
    relation.canClear && collection.isSuccess && collection.data.items.length > 0;
  const [confirmUnlinkAll, setConfirmUnlinkAll] = useState(false);
  const linkedHrefs = useMemo(
    () => new Set((collection.isSuccess ? collection.data.items : []).map((i) => i.selfLink.href)),
    [collection.isSuccess, collection.data],
  );

  function onRowClick(id: string) {
    if (!targetProfile) return;
    onItemClick?.(targetProfile.name, id);
  }

  return (
    <>
      <RelationAccordion
        open={accordionOpen}
        onOpenChange={setAccordionOpen}
        title={
          <span className="inline-flex items-center gap-2">
            {total !== undefined && (
              <CountIndicatorChip
                variant="solid"
                count={total.count}
                isEstimated={total.isEstimated}
              />
            )}
            {title}
          </span>
        }
        actions={
          <>
            {relation.canAdd && targetProfile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAdding}
                  onClick={() => setAddOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Link
                </Button>
                <RelationItemSearchDialog
                  targetProfile={targetProfile}
                  open={addOpen}
                  onOpenChange={setAddOpen}
                  onLinkSelected={(items) => {
                    const newHrefs = resolveNewlyLinkedHrefs(items, linkedHrefs);
                    if (newHrefs.length > 0) {
                      addRelation(newHrefs);
                      setAccordionOpen(true);
                    }
                  }}
                  onCreateNew={onCreateNew}
                />
              </>
            )}
            {canUnlinkAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isClearing}
                onClick={() => setConfirmUnlinkAll(true)}
              >
                <LinkBreak className="size-4" />
                {isClearing ? "Unlinking…" : "Unlink all"}
              </Button>
            )}
          </>
        }
      >
        {mutationError && (
          <MutationErrorDisplay
            error={mutationError}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        )}
        {collection.isPending && <Skeleton className="h-12 w-full rounded-md" />}
        {collection.isError && (
          <ProblemAlert model={toProblemDisplayModel(collection.error)}></ProblemAlert>
        )}
        {collection.isSuccess && collection.data.isEmpty && (
          <p className="text-sm text-muted-foreground">No items linked</p>
        )}
        {collection.isSuccess && !collection.data.isEmpty && (
          <div className="space-y-3">
            <DataTable
              entityName={relation.name}
              entityTitle={title}
              columns={columns}
              rows={rows}
              onRowClick={onRowClick}
              onUnlink={
                relation.canUnlinkItem
                  ? (id) => {
                      const item = collection.data.findById(id);
                      if (item) unlinkItem(item);
                    }
                  : undefined
              }
              isUnlinking={isUnlinking}
              onDelete={
                collection.data.items.some((i) => i.canDelete)
                  ? (id) => {
                      const item = collection.data.findById(id);
                      if (item?.canDelete) deleteItem(item);
                    }
                  : undefined
              }
              isDeleting={isDeleting}
            />
            {(collection.data.hasNext || collection.data.hasPrevious) && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!collection.data.hasPrevious}
                  onClick={() => setPageUrl(collection.data.prevHref)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {collection.data.pageSize} items on this page
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!collection.data.hasNext}
                  onClick={() => setPageUrl(collection.data.nextHref)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </RelationAccordion>
      {canUnlinkAll && (
        <AlertDialog open={confirmUnlinkAll} onOpenChange={setConfirmUnlinkAll}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink all {title.toLowerCase()}</AlertDialogTitle>
              <AlertDialogDescription>
                Remove{" "}
                {total ? (
                  <EntityItemCountLabel count={total.count} noun="linked item" />
                ) : (
                  "all linked items"
                )}
                ? This will not delete the {title.toLowerCase()} themselves.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  clearRelation();
                  setConfirmUnlinkAll(false);
                }}
              >
                Unlink all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
