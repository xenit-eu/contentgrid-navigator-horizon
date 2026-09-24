import { useState } from "react";
import {
  EyeIcon as Eye,
  LinkBreakIcon as LinkBreak,
  PlusIcon,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
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

  const total = collection.isSuccess ? collection.data.totalItems : undefined;
  const canUnlinkAll =
    relation.canClear && collection.isSuccess && collection.data.items.length > 0;
  const [confirmUnlinkAll, setConfirmUnlinkAll] = useState(false);

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
        {collection.isPending && <Skeleton className="h-12 w-full rounded-md" />}
        {collection.isError && (
          <ProblemAlert model={toProblemDisplayModel(collection.error)}></ProblemAlert>
        )}
        {collection.isSuccess && collection.data.isEmpty && (
          <p className="text-sm text-muted-foreground">No items linked</p>
        )}
        {collection.isSuccess && !collection.data.isEmpty && !targetProfile && (
          <p className="text-sm text-muted-foreground">
            The linked {title.toLowerCase()} can't be shown: their entity profile is unavailable.
          </p>
        )}
        {collection.isSuccess && !collection.data.isEmpty && targetProfile && (
          <EntityItemCollectionTable
            profile={targetProfile}
            collection={collection.data}
            onEntityItemClick={(item) => onItemClick?.(targetProfile.name, item.id)}
            onPageChange={setPageUrl}
            renderRowActions={(item) => (
              <>
                <RecordRowAction
                  label="Details"
                  icon={<Eye className="size-4" aria-hidden />}
                  onClick={() => onItemClick?.(targetProfile.name, item.id)}
                />
                {relation.canUnlinkItem && (
                  <RecordRowConfirmAction
                    label="Unlink"
                    icon={<LinkBreak className="size-4" aria-hidden />}
                    title={`Unlink ${targetProfile.singularName.toLowerCase()}`}
                    description={`Remove the link to this ${targetProfile.singularName.toLowerCase()}? This will not delete the ${targetProfile.singularName.toLowerCase()} itself.`}
                    disabled={isUnlinking}
                    onConfirm={() => unlinkItem(item)}
                  />
                )}
                {item.canDelete && (
                  <RecordRowConfirmAction
                    label="Delete"
                    icon={<Trash className="size-4" aria-hidden />}
                    title="Delete item"
                    description={`Are you sure you want to delete this ${targetProfile.singularName.toLowerCase()}? This action cannot be undone.`}
                    disabled={isDeleting}
                    onConfirm={() => deleteItem(item)}
                  />
                )}
              </>
            )}
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
