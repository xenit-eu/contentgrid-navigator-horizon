import { useState } from "react";
import {
  type EntityItemToOneRelation,
  type ProfileEntity,
  toProblemDisplayModel,
  useClearRelation,
  useEntityItemToOneRelation,
  useSetToOneRelation,
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
  Button,
  RelationAccordion,
  Skeleton,
} from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";
import { EntityItemAttributeSummary } from "../variations/entity-item-attribute-summary";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relation-handlers";
import { RelationItemSearchDialog } from "./relation-item-search-dialog";

export function RelationToOneSection({
  relation,
  profiles,
  onItemClick,
  onCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
}: Readonly<{
  relation: EntityItemToOneRelation;
  profiles: readonly ProfileEntity[];
  onItemClick?: RelationItemClickHandler;
  onCreateNew?: RelationItemCreateHandler;
}> &
  Pick<RelationProblemHandlers, "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick">) {
  const linkedItem = useEntityItemToOneRelation(relation);
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation);
  const {
    mutate: setRelation,
    reset: resetSetRelation,
    isPending: isSetting,
    error: setError,
  } = useSetToOneRelation(relation);
  // `setError` is shown inside the link dialog, which stays open until linking succeeds.
  const mutationError = clearError;
  const [linkOpen, setLinkOpen] = useState(false);
  const targetProfile = relation.profileRelation.getTargetProfile(profiles);
  const title = relation.profileRelation.title ?? relation.name;

  return (
    <RelationAccordion
      title={title}
      actions={
        <>
          {relation.canSet && targetProfile && linkedItem.isSuccess && linkedItem.data === null && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isSetting}
                onClick={() => setLinkOpen(true)}
              >
                Link
              </Button>
              <RelationItemSearchDialog
                multiple={false}
                targetProfile={targetProfile}
                open={linkOpen}
                onOpenChange={(open) => {
                  setLinkOpen(open);
                  if (!open) resetSetRelation();
                }}
                isLinking={isSetting}
                linkError={setError}
                onSelect={(item) =>
                  setRelation(item.selfLink.href, { onSuccess: () => setLinkOpen(false) })
                }
                onCreateNew={onCreateNew}
              />
            </>
          )}
          {relation.canClear && linkedItem.isSuccess && linkedItem.data !== null && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearing}>
                  {isClearing ? "Unlinking…" : "Unlink"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the link to this {title}. The linked item will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearRelation()}>Unlink</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      }
    >
      {mutationError && (
        <ProblemAlert
          model={toProblemDisplayModel(mutationError)}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
        />
      )}
      {linkedItem.isPending && <Skeleton className="h-12 w-full rounded-md" />}
      {linkedItem.isError && (
        <ProblemAlert model={toProblemDisplayModel(linkedItem.error)}></ProblemAlert>
      )}
      {linkedItem.isSuccess && linkedItem.data === null && (
        <p className="text-sm text-muted-foreground">No item linked</p>
      )}
      {linkedItem.isSuccess && linkedItem.data !== null && (
        <button
          type="button"
          className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer"
          onClick={() => {
            const linked = linkedItem.data;
            if (!linked) return;
            onItemClick?.(linked.profileEntity.name, linked.id);
          }}
        >
          <EntityItemAttributeSummary item={linkedItem.data} />
        </button>
      )}
    </RelationAccordion>
  );
}
