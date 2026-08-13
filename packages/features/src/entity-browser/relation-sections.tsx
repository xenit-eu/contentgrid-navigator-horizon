import { useMemo, useState } from "react";
import {
  type EntityItem,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  ProfileAttributeSearchType,
  type ProfileEntity,
  createValues,
  toProblemDisplayModel,
  useAddToManyRelation,
  useClearRelation,
  useDeleteRelationItem,
  useEntityItemCollection,
  useEntityItemToManyRelation,
  useEntityItemToOneRelation,
  useSetToOneRelation,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@contentgrid/ui";
import { buildColumns, buildRows } from "../preferences";
import { ProblemAlert } from "../problem-details";
import { formatAttributeValue } from "./attribute-format";
import { useTypedNavigate } from "./navigate";

// ---------------------------------------------------------------------------
// Relation section components — each owns its own hook call (Rules of Hooks)
// ---------------------------------------------------------------------------

export function RelationToOneSection({
  relation,
  profiles,
}: Readonly<{ relation: EntityItemToOneRelation; profiles: readonly ProfileEntity[] }>) {
  const go = useTypedNavigate();
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
      {mutationError && <MutationErrorDisplay error={mutationError} />}
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
            go({
              to: "/$entity/$itemId",
              params: { entity: linked.profileEntity.name, itemId: linked.id },
            });
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

export function RelationToManySection({
  relation,
  profiles,
}: Readonly<{ relation: EntityItemToManyRelation; profiles: readonly ProfileEntity[] }>) {
  const go = useTypedNavigate();
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
    go({ to: "/$entity/$itemId", params: { entity: targetProfile.name, itemId: id } });
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
      {mutationError && <MutationErrorDisplay error={mutationError} />}
      {collection.isPending && <Skeleton className="h-12 w-full rounded-md" />}
      {collection.isError && (
        <ProblemAlert model={toProblemDisplayModel(collection.isError)}></ProblemAlert>
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

function RelationItemSearchDialog({
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
            <ProblemAlert model={toProblemDisplayModel(collection.isError)}></ProblemAlert>
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

function MutationErrorDisplay({ error }: Readonly<{ error: Error }>) {
  return <ProblemAlert model={toProblemDisplayModel(error)}></ProblemAlert>;
}
