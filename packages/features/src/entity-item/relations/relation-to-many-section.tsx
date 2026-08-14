import { useMemo, useState } from "react";
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
  AlertDialogTrigger,
  Badge,
  Button,
  DataTable,
  Skeleton,
} from "@contentgrid/ui";
import { buildColumns, buildRows } from "../../preferences";
import { ProblemAlert } from "../../problem-details";
import {
  MutationErrorDisplay,
  type MutationErrorDisplayProps,
  type RelationItemClickHandler,
  RelationItemSearchDialog,
} from "./relation-shared";

export function RelationToManySection({
  relation,
  profiles,
  onItemClick,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<{
  relation: EntityItemToManyRelation;
  profiles: readonly ProfileEntity[];
  onItemClick?: RelationItemClickHandler;
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
  const targetProfile = relation.profileRelation.getTargetProfile(profiles);
  const title = relation.profileRelation.title ?? relation.name;

  const columns = useMemo(
    () => (targetProfile ? buildColumns(targetProfile) : [{ key: "id", header: "ID" }]),
    [targetProfile],
  );
  const rows = useMemo(
    () => (collection.isSuccess ? buildRows(collection.data.items, columns) : []),
    [collection.isSuccess, collection.data, columns],
  );
  const total = collection.isSuccess ? collection.data.totalItems : undefined;

  function onRowClick(id: string) {
    if (!targetProfile) return;
    onItemClick?.(targetProfile.name, id);
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {total !== undefined && (
            <Badge variant="secondary">
              {total.count.toLocaleString()} item{total.count === 1 ? "" : "s"}
              {total.isEstimated && " (est.)"}
            </Badge>
          )}
          {relation.canAdd && targetProfile && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isAdding}
                onClick={() => setAddOpen(true)}
              >
                Add
              </Button>
              <RelationItemSearchDialog
                targetProfile={targetProfile}
                open={addOpen}
                onOpenChange={setAddOpen}
                onSelect={(item) => addRelation([item.selfLink.href])}
              />
            </>
          )}
          {relation.canClear && collection.isSuccess && collection.data.items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearing}>
                  {isClearing ? "Clearing…" : "Clear all"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all {total?.count.toLocaleString() ?? "linked"} item
                    {total?.count === 1 ? "" : "s"}. The items themselves will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearRelation()}>Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
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
    </div>
  );
}
