import { useState } from "react";
import {
  EyeIcon as Eye,
  LinkBreakIcon as LinkBreak,
  PlusIcon,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import {
  type EntityItem,
  type EntityItemToManyRelation,
  type ProfileEntity,
  toProblemDisplayModel,
  useAddToManyRelation,
  useClearRelation,
  useDeleteRelationItem,
  useEntityItemToManyRelation,
  useEntityItemToManyRelationInfinite,
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
  RecordRowAction,
  RecordRowConfirmAction,
  RelationAccordion,
  Skeleton,
} from "@contentgrid/ui";
import { EntityItemCollectionTable, EntityItemCountLabel } from "../../entity-item-collection";
import { ProblemAlert } from "../../problem-details";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relation-handlers";
import { RelationItemSearchDialog } from "./relation-item-search-dialog";
import { RelationItemStack } from "./relation-item-stack";
import { useRelationLayout } from "./relation-layout";

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
    RelationProblemHandlers,
    "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
  >) {
  // Wide panes get the paged record table, narrow ones a stack of item references with
  // "Load more". Both queries are always called (Rules of Hooks); only the one for the current
  // layout is enabled, and both share the relation's query namespace, so mutations refresh either.
  const { toManyTable } = useRelationLayout();
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  const collection = useEntityItemToManyRelation(relation, pageUrl ? { url: pageUrl } : undefined, {
    enabled: toManyTable,
  });
  const loadedPages = useEntityItemToManyRelationInfinite(relation, { enabled: !toManyTable });
  // State of whichever query the current layout shows, in one shape for the header and body.
  const current = toManyTable
    ? {
        isPending: collection.isPending,
        error: collection.isError ? collection.error : null,
        firstPage: collection.isSuccess ? collection.data : undefined,
      }
    : {
        isPending: loadedPages.isPending,
        error: loadedPages.isError ? loadedPages.error : null,
        firstPage: loadedPages.isSuccess ? loadedPages.data.pages[0] : undefined,
      };
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation, {
    mutationOptions: { onSuccess: () => setPageUrl(undefined) },
  });
  const {
    mutate: addRelation,
    reset: resetAddRelation,
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
  // `addError` is shown inside the link dialog, which stays open until linking succeeds.
  const mutationError = clearError ?? unlinkError ?? deleteError;
  const [addOpen, setAddOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const targetProfile = relation.profileRelation.getTargetProfile(profiles);
  const title = relation.profileRelation.title ?? relation.name;

  const total = current.firstPage?.totalItems;
  const canUnlinkAll = relation.canClear && (current.firstPage?.items.length ?? 0) > 0;
  const [confirmUnlinkAll, setConfirmUnlinkAll] = useState(false);

  /** Unlink/delete controls for one linked item, shared by the table rows and the stack. */
  function renderItemActions(item: EntityItem) {
    if (!targetProfile) return null;
    const noun = targetProfile.singularName.toLowerCase();
    return (
      <>
        {relation.canUnlinkItem && (
          <RecordRowConfirmAction
            label="Unlink"
            icon={<LinkBreak className="size-4" aria-hidden />}
            title={`Unlink ${noun}`}
            description={`Remove the link to this ${noun}? This will not delete the ${noun} itself.`}
            disabled={isUnlinking}
            onConfirm={() => unlinkItem(item)}
          />
        )}
        {item.canDelete && (
          <RecordRowConfirmAction
            label="Delete"
            icon={<Trash className="size-4" aria-hidden />}
            title="Delete item"
            description={`Are you sure you want to delete this ${noun}? This action cannot be undone.`}
            disabled={isDeleting}
            onConfirm={() => deleteItem(item)}
          />
        )}
      </>
    );
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
                  onOpenChange={(open) => {
                    setAddOpen(open);
                    if (!open) resetAddRelation();
                  }}
                  multiple
                  isLinking={isAdding}
                  linkError={addError}
                  onLinkSelected={(items) =>
                    addRelation(
                      items.map((item) => item.selfLink.href),
                      {
                        onSuccess: () => {
                          setAddOpen(false);
                          setAccordionOpen(true);
                        },
                      },
                    )
                  }
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
          <ProblemAlert
            model={toProblemDisplayModel(mutationError)}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        )}
        {current.isPending && <Skeleton className="h-12 w-full rounded-md" />}
        {current.error && (
          <ProblemAlert model={toProblemDisplayModel(current.error)}></ProblemAlert>
        )}
        {current.firstPage?.isEmpty && (
          <p className="text-sm text-muted-foreground">No items linked</p>
        )}
        {current.firstPage && !current.firstPage.isEmpty && !targetProfile && (
          <p className="text-sm text-muted-foreground">
            The linked {title.toLowerCase()} can't be shown: their entity profile is unavailable.
          </p>
        )}
        {toManyTable && collection.isSuccess && !collection.data.isEmpty && targetProfile && (
          <EntityItemCollectionTable
            profile={targetProfile}
            collection={collection.data}
            className="max-h-80"
            onEntityItemClick={(item) => onItemClick?.(targetProfile.name, item.id)}
            onPageChange={setPageUrl}
            renderRowActions={(item) => (
              <>
                <RecordRowAction
                  label="Details"
                  icon={<Eye className="size-4" aria-hidden />}
                  onClick={() => onItemClick?.(targetProfile.name, item.id)}
                />
                {renderItemActions(item)}
              </>
            )}
          />
        )}
        {!toManyTable &&
          loadedPages.isSuccess &&
          !loadedPages.data.pages[0]?.isEmpty &&
          targetProfile && (
            <RelationItemStack
              items={loadedPages.data.pages.flatMap((page) => page.items)}
              hasNextPage={loadedPages.hasNextPage}
              isFetchingNextPage={loadedPages.isFetchingNextPage}
              fetchNextPage={() => void loadedPages.fetchNextPage()}
              onItemClick={(item) => onItemClick?.(targetProfile.name, item.id)}
              renderItemActions={renderItemActions}
            />
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
