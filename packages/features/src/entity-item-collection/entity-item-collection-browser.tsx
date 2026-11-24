import { useLayoutEffect, useRef, useState } from "react";
import {
  type EntityItem,
  type ProfileEntity,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ResizableSplitLayout,
  type SplitPaneHandle,
  useContainerWidthAtLeast,
} from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { EntityItemReference } from "../entity-item";
import { EntitySearchBar } from "../entity-search-bar";
import { EntityItemCollectionEmptyState } from "./entity-item-collection-empty-state";
import { EntityItemCollectionTable } from "./entity-item-collection-table";
import { EntityItemCollectionTitle } from "./entity-item-collection-title";
import { EntityItemPreviewPane } from "./entity-item-preview-pane";
import { useEntityItemCollectionSearch } from "./use-entity-item-collection-search";

/** Width the preview pane opens at, beside the table. */
const PREVIEW_PANE_SIZE = "45%";

export interface EntityItemCollectionBrowserProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /**
   * Opens the item's own page; receives the item. Rows show a View action only with it. A row
   * click previews the item beside the table (or in a dialog when narrow) either way.
   */
  readonly onEntityItemClick?: (item: EntityItem) => void;
  /**
   * Fired when the user paginates; receives the target page's href
   * (`collection.nextHref` / `collection.prevHref`).
   */
  readonly onPageChange?: (href: string | undefined) => void;
  /** Current filter values, keyed by search property name. Defaults to no filters applied. */
  readonly filters?: Record<string, string>;
  /** Fired when the user changes or clears a filter; receives the full next filters map. */
  readonly onFiltersChange?: (filters: Record<string, string>) => void;
  /** Currently active sort value, e.g. `"name,asc"`. Defaults to no sort applied. */
  readonly currentSort?: string;
  /** Fired when the user changes or clears the sort; receives the next sort value (or `undefined`). */
  readonly onSortChange?: (sort: string | undefined) => void;
  /** Fired when the user clicks create; offered when the collection has no items. */
  readonly onCreateItemClick?: () => void;
}

/**
 * App-agnostic collection view: fetches the entity's items and renders the filter form, table,
 * and pagination controls. All routing / navigation / page chrome is supplied by the caller
 * through `onEntityItemClick`, `onPageChange`, `onFiltersChange` — this component performs no
 * navigation itself and renders no toolbar/layout (the view above it draws those).
 *
 * Filters render through `@contentgrid/features/hal-forms`'s generic `HalFormsContainer` rather
 * than the earlier `FilterSidebar` pattern (`@contentgrid/ui`) — `resolveHalFormsFields` derives
 * the same two-column layout and field kinds (including `autocomplete` for a prefix/full-text
 * search property) directly from the search template, already deduplicated (hidden properties
 * excluded, redundant exact-match/range siblings suppressed). `../search/filter-properties`'s
 * remaining functions reuse that same `fields` list as their source of truth for how a filter
 * value round-trips to/from the raw `filters: Record<string, string>` contract this view's own
 * caller-facing props keep (URL-state-backed, per `filter-url-state.ts`) — there's no separate
 * view-model list to keep in sync with `fields` any more. `FilterSidebar` itself is now unused
 * by this view; it's fine to remove it or its own `TypeaheadTextFilter` next, but neither is
 * touched here.
 *
 * The browser also owns the row preview: clicking a row (or pressing Enter/Space on it) shows the
 * item beside the table, or in a dialog when the browser is narrow, as the list currently has it.
 */
export function EntityItemCollectionBrowser({
  profile,
  pageUrl,
  onEntityItemClick,
  onPageChange,
  filters = EMPTY_FILTERS,
  onFiltersChange,
  currentSort,
  onSortChange,
  onCreateItemClick,
}: Readonly<EntityItemCollectionBrowserProps>) {
  const { collection, toolbarActions, filterDialog, tableProps } = useEntityItemCollectionSearch({
    profile,
    pageUrl,
    onPageChange,
    filters,
    onFiltersChange,
    currentSort,
    onSortChange,
  });

  // Start screen only for an unfiltered first page with no items; it replaces the search bar and
  // the table, as there is nothing to search, filter or sort. A filtered search keeps both so its
  // filters stay reachable. Placeholder data is the previous search's result, so it
  // can't tell whether this search is empty.
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const isEmptyCollection =
    collection.isSuccess &&
    !collection.isPlaceholderData &&
    collection.data.items.length === 0 &&
    !collection.data.hasPrevious &&
    activeFilterCount === 0;

  // The preview: beside the table when this browser is at least the `side-by-side` width, in a
  // dialog otherwise. The width is this browser's own, so a sidebar or a split pane counts.
  const rootRef = useRef<HTMLDivElement>(null);
  // Where focus goes when the previewed row is no longer listed.
  const tableRegionRef = useRef<HTMLDivElement>(null);
  const isWide = useContainerWidthAtLeast(rootRef, "side-by-side");
  const splitPaneRef = useRef<SplitPaneHandle>(null);
  const [previewedId, setPreviewedId] = useState<string>();
  // The row the preview was opened from, to give focus back to when the preview closes.
  const previewRowRef = useRef<HTMLElement | null>(null);
  const wasPreviewOpenRef = useRef(false);
  // Whether focus is inside the wide pane. Removing the focused element fires no blur, so this
  // is still set when the pane closes with its focus in it.
  const paneHasFocusRef = useRef(false);
  // Set when the pane is closed from its resize handle: focus was on the handle, which is gone.
  const closedFromHandleRef = useRef(false);

  // Crossing the width closes the preview rather than moving it between pane and dialog.
  const [previewWasWide, setPreviewWasWide] = useState(isWide);
  if (previewWasWide !== isWide) {
    setPreviewWasWide(isWide);
    setPreviewedId(undefined);
  }

  // The item as the shown page has it, so a refetch shows its new values. When the shown page
  // no longer has it (filter, sort, page change, delete), the preview closes. While a new page
  // loads, the previous page stays shown, so this happens once the new page is in.
  const previewedItem = previewedId ? collection.data?.findById(previewedId) : undefined;
  if (previewedId && collection.data && !previewedItem) {
    setPreviewedId(undefined);
  }
  const isPreviewOpen = previewedItem !== undefined;

  // The narrow dialog keeps showing the last previewed item while it animates closed. Looking
  // the item up gives a new object per render, so only a different item updates it.
  const [lastPreviewedItem, setLastPreviewedItem] = useState<EntityItem>();
  if (previewedItem && previewedItem.id !== lastPreviewedItem?.id) {
    setLastPreviewedItem(previewedItem);
  }
  const dialogItem = previewedItem ?? lastPreviewedItem;

  function handlePreview(item: EntityItem) {
    // A row has focus here: clicking it or pressing Enter/Space on it focuses it.
    previewRowRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreviewedId(item.id);
  }

  function closePreview() {
    setPreviewedId(undefined);
  }

  /** Focuses the row the preview was opened from, falling back to the table region once it is gone. */
  function focusRowOrTableRegion() {
    const row = previewRowRef.current?.isConnected ? previewRowRef.current : tableRegionRef.current;
    row?.focus();
  }

  useLayoutEffect(() => {
    const pane = splitPaneRef.current;
    if (pane && isPreviewOpen && pane.isCollapsed()) pane.resize(PREVIEW_PANE_SIZE);
    if (pane && !isPreviewOpen && !pane.isCollapsed()) pane.collapse();

    // Closing the pane removes what had focus inside it; give focus back to the row. Focus that
    // was somewhere else stays there.
    const justClosed = wasPreviewOpenRef.current && !isPreviewOpen;
    wasPreviewOpenRef.current = isPreviewOpen;
    if (justClosed && (paneHasFocusRef.current || closedFromHandleRef.current)) {
      focusRowOrTableRegion();
    }
    if (!isPreviewOpen) {
      paneHasFocusRef.current = false;
      closedFromHandleRef.current = false;
    }
  }, [isPreviewOpen]);

  const previewPane = previewedItem && (
    <EntityItemPreviewPane entityItem={previewedItem} onClose={closePreview} />
  );

  const table = (
    <div
      ref={tableRegionRef}
      role="region"
      aria-label={`${profile.pluralName} table`}
      tabIndex={-1}
      className="h-full outline-none"
    >
      {collection.isPending && <LoadingPage />}

      {collection.isError && <ErrorPage model={toProblemDisplayModel(collection.error)} />}

      {isEmptyCollection && (
        <EntityItemCollectionEmptyState profile={profile} onCreateItemClick={onCreateItemClick} />
      )}

      {collection.isSuccess && !isEmptyCollection && (
        <EntityItemCollectionTable
          className="h-full"
          profile={profile}
          collection={collection.data}
          onEntityItemClick={handlePreview}
          onEntityItemOpen={onEntityItemClick}
          currentItem={previewedItem}
          onPageChange={onPageChange}
          {...tableProps}
          // Without a search bar (no `onFiltersChange`), the table keeps the controls itself.
          tableActions={onFiltersChange ? undefined : toolbarActions}
        />
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      {/* From the profile on, so it is there while the page loads, fails or is empty too. The
          count is the shown search's own total; while a new search loads, the previous one's. */}
      <EntityItemCollectionTitle
        profile={profile}
        total={collection.data?.totalItems}
        isFiltered={activeFilterCount > 0}
      />

      {onFiltersChange && !isEmptyCollection && (
        <EntitySearchBar
          className="shrink-0 p-4"
          profileEntity={profile}
          filters={filters}
          onFiltersChange={onFiltersChange}
          currentSort={currentSort}
          actions={toolbarActions}
        />
      )}

      <div className={`min-h-0 flex-1 px-4 pb-4 ${onFiltersChange ? "" : "pt-4"}`}>
        {isWide ? (
          // The pane's panel is always there, collapsed while nothing is previewed, so opening
          // the pane never remounts the table.
          <ResizableSplitLayout
            left={table}
            right={
              previewPane && (
                // Escape closes the pane, unless an inner control (an open select, say) took it.
                <div
                  className="h-full"
                  onFocusCapture={() => {
                    paneHasFocusRef.current = true;
                  }}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      paneHasFocusRef.current = false;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !event.defaultPrevented) closePreview();
                  }}
                >
                  {previewPane}
                </div>
              )
            }
            defaultRightSize={0}
            minLeftSize={320}
            minRightSize={360}
            rightCollapsible
            rightCollapsedSize={0}
            rightPanelRef={splitPaneRef}
            // Dragging the pane shut closes it like its Close button.
            onRightCollapsedChange={(collapsed) => {
              if (!collapsed) return;
              // The pane's own collapse after a close reports here too, with nothing open.
              if (isPreviewOpen) closedFromHandleRef.current = true;
              closePreview();
            }}
            resizable={isPreviewOpen}
            handleLabel="Resize preview"
            // While closed there is nothing to separate: no line, no gutter, no separator.
            handleHidden={!isPreviewOpen}
            handleClassName="mx-2"
          />
        ) : (
          table
        )}
      </div>

      {!isWide && (
        <Dialog open={isPreviewOpen} onOpenChange={(open) => !open && closePreview()}>
          {/* The pane draws the border and its own Close button. */}
          <DialogContent
            showCloseButton={false}
            // Focus the dialog itself rather than its first button, the pane's Close: focusing a
            // button opens its tooltip, which the first Escape would close instead of the dialog.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement).focus();
            }}
            // Back to the row on close, also when a refetch removed it.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusRowOrTableRegion();
            }}
            // A dialog overlays the window rather than filling a parent, so it is sized to the
            // window, like the create form's preview dialog.
            className="flex h-[80vh] flex-col gap-0 border-0 p-0 sm:max-w-3xl"
          >
            {/* Names the dialog after the item, like the pane's region. */}
            <DialogTitle asChild>
              <div className="sr-only">
                {dialogItem ? (
                  <EntityItemReference item={dialogItem} size="sm" />
                ) : (
                  `${profile.singularName} preview`
                )}
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              The item's preview and details.
            </DialogDescription>
            {dialogItem && <EntityItemPreviewPane entityItem={dialogItem} onClose={closePreview} />}
          </DialogContent>
        </Dialog>
      )}

      {filterDialog}
    </div>
  );
}

const EMPTY_FILTERS: Record<string, string> = {};
