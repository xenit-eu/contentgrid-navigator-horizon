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
  Skeleton,
} from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";
import { formatAttributeValue } from "../attributes/attribute-format";
import {
  MutationErrorDisplay,
  type MutationErrorDisplayProps,
  type RelationItemClickHandler,
  RelationItemSearchDialog,
} from "./relation-shared";

export function RelationToOneSection({
  relation,
  profiles,
  onItemClick,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onReload,
}: Readonly<{
  relation: EntityItemToOneRelation;
  profiles: readonly ProfileEntity[];
  onItemClick?: RelationItemClickHandler;
}> &
  Pick<
    MutationErrorDisplayProps,
    "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onReload"
  >) {
  const linkedItem = useEntityItemToOneRelation(relation);
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation);
  const {
    mutate: setRelation,
    isPending: isSetting,
    error: setError,
  } = useSetToOneRelation(relation);
  const mutationError = clearError ?? setError;
  const [linkOpen, setLinkOpen] = useState(false);
  const targetProfile = relation.profileRelation.getTargetProfile(profiles);
  const title = relation.profileRelation.title ?? relation.name;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
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
                targetProfile={targetProfile}
                open={linkOpen}
                onOpenChange={setLinkOpen}
                onSelect={(item) => setRelation(item.selfLink.href)}
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
        </div>
      </div>
      {mutationError && (
        <MutationErrorDisplay
          error={mutationError}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onReload={onReload}
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
          <dl className="grid grid-cols-2 gap-2">
            {linkedItem.data.userDefinedAttributes.slice(0, 4).map((attr) => {
              const label =
                linkedItem.data!.profileEntity.attributes.find((a) => a.name === attr.value.name)
                  ?.title ?? attr.value.name;
              return (
                <div key={attr.value.name}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm truncate">{formatAttributeValue(attr)}</dd>
                </div>
              );
            })}
          </dl>
        </button>
      )}
    </div>
  );
}
