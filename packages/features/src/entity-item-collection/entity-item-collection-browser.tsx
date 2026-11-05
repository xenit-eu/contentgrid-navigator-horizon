import {
  type EntityItem,
  type ProfileEntity,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { EntitySearchBar } from "../entity-search-bar";
import { EntityItemCollectionTable } from "./entity-item-collection-table";
import { useEntityItemCollectionSearch } from "./use-entity-item-collection-search";

export interface EntityItemCollectionBrowserProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /** Fired when an entity item row is clicked; receives the item id. */
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onFiltersChange && (
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
        {collection.isPending && <LoadingPage />}

        {collection.isError && <ErrorPage model={toProblemDisplayModel(collection.error)} />}

        {collection.isSuccess && (
          <EntityItemCollectionTable
            className="h-full"
            profile={profile}
            collection={collection.data}
            onEntityItemClick={onEntityItemClick}
            onPageChange={onPageChange}
            {...tableProps}
            // Without a search bar (no `onFiltersChange`), the table keeps the controls itself.
            tableActions={onFiltersChange ? undefined : toolbarActions}
          />
        )}
      </div>

      {filterDialog}
    </div>
  );
}

const EMPTY_FILTERS: Record<string, string> = {};
