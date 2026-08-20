import { useEffect, useState } from "react";
import {
  type EntityItem,
  ProfileAttributeSearchType,
  type ProfileEntity,
  createValues,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@contentgrid/ui";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
  notifyReloadOnUnsatisfiedVersion,
} from "../../problem-details";
import { formatAttributeValue } from "../attributes/attribute-format";

/**
 * Fired when the user clicks through to a related entity item; receives the
 * target entity's profile name and the item's id. All navigation is left to
 * the caller — the relation sections perform none themselves.
 */
export type RelationItemClickHandler = (profileEntityName: string, itemId: string) => void;

// ---------------------------------------------------------------------------
// RelationItemSearchDialog — search and select an entity item to link
// ---------------------------------------------------------------------------

/**
 * Builds the search values for the relation-item search dialog: applies the
 * query text to the given search property when both are present, otherwise
 * returns the template's default (empty) values.
 */
function buildRelationSearchValues(
  searchTemplate: NonNullable<ProfileEntity["searchTemplate"]>,
  query: string,
  searchProperty:
    | ReturnType<NonNullable<ProfileEntity["searchTemplate"]>["getSearchPropertiesByType"]>[number]
    | undefined,
) {
  const values = createValues(searchTemplate.template);
  return query && searchProperty ? values.withValue(searchProperty.property.name, query) : values;
}

export function RelationItemSearchDialog({
  targetProfile,
  open,
  onOpenChange,
  onSelect,
}: Readonly<{
  targetProfile: ProfileEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: EntityItem) => void;
}>) {
  const [query, setQuery] = useState("");

  const searchTemplate = targetProfile.searchTemplate;
  const searchProperty =
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.prefixMatch)[0] ??
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.fullText)[0];

  const searchValues = searchTemplate
    ? buildRelationSearchValues(searchTemplate, query, searchProperty)
    : undefined;

  const collection = useEntityItemCollection(
    searchValues !== undefined
      ? { profileEntity: targetProfile, searchValues }
      : { profileEntity: targetProfile },
  );

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {targetProfile.pluralName}</DialogTitle>
          <DialogDescription>Search for an item to link.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder={`Search ${targetProfile.pluralName}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {collection.isPending && <Skeleton className="h-40 w-full rounded-md" />}
        {collection.isError && (
          <p className="text-sm text-destructive">
            <ProblemAlert model={toProblemDisplayModel(collection.error)}></ProblemAlert>
          </p>
        )}
        {collection.isSuccess && collection.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
        )}
        {collection.isSuccess && collection.data.items.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {collection.data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer"
                onClick={() => {
                  onSelect(item);
                  handleOpenChange(false);
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {item.userDefinedAttributes.slice(0, 4).map((attr) => {
                    const label =
                      targetProfile.attributes.find((a) => a.name === attr.value.name)?.title ??
                      attr.value.name;
                    return (
                      <div key={attr.value.name}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm truncate">{formatAttributeValue(attr)}</p>
                      </div>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MutationErrorDisplay — structured error from a failed relation mutation
// ---------------------------------------------------------------------------

export interface MutationErrorDisplayProps {
  readonly error: Error;
  /**
   * Fires for a `missing-relation-target` validation error (HTTP 400) — the
   * href being linked no longer resolves to an entity item. Receives the
   * dangling `missingItem` href and the offending field, if any.
   */
  readonly onMissingRelationTargetClick?: ValidationAlertProps["onMissingRelationTargetClick"];
  /**
   * Fires for a `blind-relation-overwrite` conflict (HTTP 409) from setting a
   * to-one relation that's already pointed at a different item — fix is to
   * unlink the existing relation first, then set the new one. Receives the
   * existing/new item and relation hrefs from the problem body.
   */
  readonly onBlindRelationOverwriteClick?: RelationConflictAlertProps["onBlindRelationOverwriteClick"];
  /**
   * Fires for a `required-relation` conflict (HTTP 409) — the item can't be
   * deleted/unlinked because a required relation elsewhere still points to
   * it; that referencing entity must be deleted or re-linked first. Receives
   * the affected relation's href.
   */
  readonly onRequiredRelationClick?: RelationConflictAlertProps["onRequiredRelationClick"];
  /**
   * Fires for an `unsatisfiedVersion` (HTTP 412) problem — the item was
   * modified concurrently. Recovery is re-fetch, re-apply, retry: this
   * should re-fetch the parent entity item so `relation` picks up the fresh
   * ETag. Also drives the reload toast; without it, the 412 falls back to
   * the plain inline alert with no action.
   */
  readonly onReload?: () => void;
}

export function MutationErrorDisplay({
  error,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  onReload,
}: Readonly<MutationErrorDisplayProps>) {
  useEffect(() => {
    if (onReload) {
      notifyReloadOnUnsatisfiedVersion(error, onReload);
    }
  }, [error, onReload]);

  return (
    <ProblemAlert
      model={toProblemDisplayModel(error)}
      onMissingRelationTargetClick={onMissingRelationTargetClick}
      onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
      onRequiredRelationClick={onRequiredRelationClick}
      onRetryClick={onReload}
    ></ProblemAlert>
  );
}
