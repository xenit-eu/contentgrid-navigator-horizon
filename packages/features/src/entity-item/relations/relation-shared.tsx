import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  AttributeKind,
  type EntityItem,
  ProfileAttributeSearchType,
  type ProfileEntity,
  createValues,
  toProblemDisplayModel,
  useEntityItemCollection,
  useTypeahead,
} from "@contentgrid/navigator-data";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TypeaheadRenderer,
} from "@contentgrid/ui";
import { buildColumns, buildRows, useColumnVisibility } from "../../preferences";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
} from "../../problem-details";
import { AttributeValueRenderer } from "../attributes/renderers/attribute-value-renderer";

/**
 * Fired when the user clicks through to a related entity item; receives the
 * target entity's profile name and the item's id. All navigation is left to
 * the caller — the relation sections perform none themselves.
 */
export type RelationItemClickHandler = (profileEntityName: string, itemId: string) => void;

/**
 * Fired when the user asks to create a new item for a relation's target entity, from
 * `RelationItemSearchDialog`'s "Create new" affordance — receives the target entity's profile
 * name. All navigation is left to the caller, same as `RelationItemClickHandler`.
 */
export type RelationItemCreateHandler = (profileEntityName: string) => void;

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

/**
 * Filters a `RelationItemSearchDialog` multi-select confirmation down to hrefs that aren't
 * already linked, toasting how many (if any) were skipped as duplicates. Shared by every
 * `onLinkSelected` caller (the edit-view's `RelationToManySection` and the create-form's
 * `RelationField`) so the duplicate-skip message and its counting logic live in exactly one
 * place instead of being copy-pasted per caller.
 */
export function resolveNewlyLinkedHrefs(
  items: readonly EntityItem[],
  alreadyLinkedHrefs: ReadonlySet<string>,
): string[] {
  const newHrefs = items
    .map((item) => item.selfLink.href)
    .filter((href) => !alreadyLinkedHrefs.has(href));
  const duplicateCount = items.length - newHrefs.length;
  if (duplicateCount > 0) {
    toast.info(
      duplicateCount === 1
        ? "1 item was already linked and was skipped."
        : `${duplicateCount} items were already linked and were skipped.`,
    );
  }
  return newHrefs;
}

export function RelationItemSearchDialog({
  targetProfile,
  open,
  onOpenChange,
  onSelect,
  onLinkSelected,
  onCreateNew,
}: Readonly<{
  targetProfile: ProfileEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single-item pick — clicking a result links it immediately and closes the dialog. Used for
   * to-one relations, where only one item can ever be linked. */
  onSelect?: (item: EntityItem) => void;
  /**
   * Multi-item pick — renders a checkbox per result plus a "Link entity items" bulk action
   * instead of click-to-link rows, mirroring legacy Navigator's relation picker. Used for
   * to-many relations. Presence of this prop (rather than `onSelect`) is what switches the
   * dialog into multi-select mode — a caller supplies exactly one of the two, matching its
   * relation's cardinality.
   */
  onLinkSelected?: (items: readonly EntityItem[]) => void;
  /** Renders a "Create new" affordance, gated on `targetProfile.createTemplate` (ABAC — absence
   * means create isn't permitted). Omit to not offer it at all. */
  onCreateNew?: RelationItemCreateHandler;
}>) {
  const multiSelect = !!onLinkSelected;
  const [query, setQuery] = useState("");
  // A HAL next/prev link for the current search — reset to the first page whenever the query
  // changes, since a new search invalidates the previous page's cursor.
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  // Keyed by id (not a Set) so a selection made on one page survives paging to another — `DataTable`
  // only knows about the current page's rows, but linking needs every selected item's full data
  // (for its href), not just its id.
  const [selectedItems, setSelectedItems] = useState<ReadonlyMap<string, EntityItem>>(new Map());

  const searchTemplate = targetProfile.searchTemplate;
  const searchProperty =
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.prefixMatch)[0] ??
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.fullText)[0];

  const searchValues = searchTemplate
    ? buildRelationSearchValues(searchTemplate, query, searchProperty)
    : undefined;

  const collection = useEntityItemCollection(
    pageUrl !== undefined
      ? { url: pageUrl, profileEntity: targetProfile }
      : searchValues !== undefined
        ? { profileEntity: targetProfile, searchValues }
        : { profileEntity: targetProfile },
  );

  // Suggestions for the search box, driven off the same search property/values the search
  // itself uses — mirrors `entity-item-collection-view.tsx`'s filter-sidebar typeahead wiring.
  const typeahead = useTypeahead({
    profileEntity: targetProfile,
    searchProperty,
    searchValues,
    minLength: 1,
  });

  // Same columns/rows the relation's own linked-items table uses (`buildColumns`/`buildRows`),
  // so the picker's multi-select table looks like every other table in the app instead of a
  // bespoke layout.
  const visibility = useColumnVisibility(targetProfile);
  const columns = useMemo(
    () => buildColumns(targetProfile, visibility),
    [targetProfile, visibility],
  );
  const rows = useMemo(
    () => (collection.isSuccess ? buildRows(collection.data.items, columns) : []),
    [collection.isSuccess, collection.data, columns],
  );

  function handleQueryChange(next: string) {
    setQuery(next);
    setPageUrl(undefined);
    typeahead.setQuery(next);
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setPageUrl(undefined);
      setSelectedItems(new Map());
      typeahead.setQuery("");
    }
  }

  function handleSelectionChange(nextIds: ReadonlySet<string>) {
    setSelectedItems((prev) => {
      const next = new Map<string, EntityItem>();
      for (const id of nextIds) {
        const item = prev.get(id) ?? collection.data?.items.find((i) => i.id === id);
        if (item) next.set(id, item);
      }
      return next;
    });
  }

  function handleLinkSelected() {
    onLinkSelected?.([...selectedItems.values()]);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // Without this, Radix's default "focus the first focusable element" lands on the
          // header's Create button (it's the first one in DOM order) — which then shows ITS
          // tooltip immediately (Radix Tooltip opens on focus, not only on hover, for keyboard
          // accessibility), making the tooltip appear to pop up on its own as soon as the dialog
          // opens. Focusing the search input instead is also just better UX (start typing right
          // away) and, as a side effect, leaves the Create button unfocused until the user
          // actually hovers or tabs to it.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)
            ?.querySelector<HTMLInputElement>('input[name="relation-search"]')
            ?.focus();
        }}
      >
        {/* `pr-6`: `DialogContent`'s close (×) button is `absolute top-4 right-4` on top of this
         * padded content area — without reserving some space here, a right-aligned header action
         * (the "Create new" button below) visually collides with it. */}
        <DialogHeader className="flex-row items-start justify-between gap-4 pr-6 sm:text-left">
          <div>
            <DialogTitle>Link {targetProfile.pluralName}</DialogTitle>
            <DialogDescription>Search for an item to link.</DialogDescription>
          </div>
          {targetProfile.createTemplate && onCreateNew && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>Create new {targetProfile.singularName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </DialogHeader>
        <TypeaheadRenderer
          name="relation-search"
          aria-label={`Search ${targetProfile.pluralName}`}
          placeholder={`Search ${targetProfile.pluralName}…`}
          value={query}
          onChange={handleQueryChange}
          suggestions={typeahead.results.map((r) => r.value)}
          isLoading={typeahead.isLoading}
        />
        {multiSelect && selectedItems.size > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-sm font-medium">
              {selectedItems.size} item{selectedItems.size === 1 ? "" : "s"} selected
            </p>
            <Button type="button" size="sm" onClick={handleLinkSelected}>
              Link entity items
            </Button>
          </div>
        )}
        {collection.isPending && <Skeleton className="h-40 w-full rounded-md" />}
        {collection.isError && (
          <p className="text-sm text-destructive">
            <ProblemAlert model={toProblemDisplayModel(collection.error)}></ProblemAlert>
          </p>
        )}
        {collection.isSuccess && collection.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
        )}
        {collection.isSuccess &&
          collection.data.items.length > 0 &&
          (multiSelect ? (
            // `min-w-0`: `DialogContent` is `display: grid`, so this wrapper is a grid item with
            // a default `min-width: auto` — without overriding it, the item refuses to shrink
            // below the table's intrinsic (unwrapped) content width, pushing the extra columns
            // silently past the dialog's edge instead of letting `DataTable`'s own scroll area
            // (below) clip and scroll them. Only `min-w-0` lives here — the height cap and
            // scrolling itself go on `DataTable`'s `containerClassName`, not this wrapper, so the
            // horizontal scrollbar sits at the bottom of the *visible* rows instead of the
            // table's full row count (see that prop's doc comment for why the two can't be the
            // same element as separate ancestor/descendant boxes).
            <div className="min-w-0">
              <DataTable
                entityName={targetProfile.name}
                entityTitle={targetProfile.pluralName}
                columns={columns}
                rows={rows}
                selectedIds={new Set(selectedItems.keys())}
                onSelectionChange={handleSelectionChange}
                onRowClick={(id) => {
                  const next = new Set(selectedItems.keys());
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  handleSelectionChange(next);
                }}
                containerClassName="max-h-64 overflow-auto"
              />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {collection.data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => {
                    onSelect?.(item);
                    handleOpenChange(false);
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {item.userDefinedAttributes
                      .filter((attr) => attr.value.kind !== AttributeKind.NESTED)
                      .slice(0, 4)
                      .map((attr) => {
                        const label =
                          targetProfile.attributes.find((a) => a.name === attr.value.name)?.title ??
                          attr.value.name;
                        return (
                          <div key={attr.value.name}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm truncate">
                              <AttributeValueRenderer attr={attr} />
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </button>
              ))}
            </div>
          ))}
        {collection.isSuccess && (collection.data.hasPrevious || collection.data.hasNext) && (
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!collection.data.hasPrevious}
              onClick={() => setPageUrl(collection.data.prevHref)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!collection.data.hasNext}
              onClick={() => setPageUrl(collection.data.nextHref)}
            >
              Next
            </Button>
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
}

export function MutationErrorDisplay({
  error,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<MutationErrorDisplayProps>) {
  return (
    <ProblemAlert
      model={toProblemDisplayModel(error)}
      onMissingRelationTargetClick={onMissingRelationTargetClick}
      onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
      onRequiredRelationClick={onRequiredRelationClick}
    ></ProblemAlert>
  );
}
