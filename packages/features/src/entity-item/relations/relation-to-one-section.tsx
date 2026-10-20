import { useState } from "react";
import { LinkBreakIcon as LinkBreak } from "@phosphor-icons/react";
import {
  type EntityItem,
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
import { useEntityDisplayPreferences } from "../../preferences";
import { ProblemAlert } from "../../problem-details";
import { EntityItemAttributeSummary } from "../variations/entity-item-attribute-summary";
import { EntityItemReference } from "../variations/entity-item-reference";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relation-handlers";
import { RelationItemSearchDialog } from "./relation-item-search-dialog";
import { type RelationLayout, useRelationLayout } from "./relation-layout";

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
  const layout = useRelationLayout();

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
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isClearing}
                >
                  <LinkBreak className="size-4" />
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
        <LinkedItem
          item={linkedItem.data}
          layout={layout}
          onClick={(item) => onItemClick?.(item.profileEntity.name, item.id)}
        />
      )}
    </RelationAccordion>
  );
}

/**
 * The linked item as its reference (icon, name, subtitle). When the pane has room for it
 * (`layout.toOneSummaryColumns`), a grid of further attributes follows, leaving out the ones the
 * reference already shows.
 */
function LinkedItem({
  item,
  layout,
  onClick,
}: Readonly<{ item: EntityItem; layout: RelationLayout; onClick: (item: EntityItem) => void }>) {
  const { nameAttribute, subtitleAttribute } = useEntityDisplayPreferences(item.profileEntity);
  const columns = layout.toOneSummaryColumns;
  const shownByReference = [nameAttribute?.name, subtitleAttribute?.name].filter(
    (name): name is string => name !== undefined,
  );

  return (
    <div className="space-y-3 rounded-md border p-2">
      <EntityItemReference
        item={item}
        size="default"
        onClick={() => onClick(item)}
        className="p-1"
      />
      {columns !== 0 && (
        <EntityItemAttributeSummary
          item={item}
          columns={columns}
          count={layout.toOneSummaryCount}
          excludeAttributeNames={shownByReference}
          className="px-1 pb-1"
        />
      )}
    </div>
  );
}
