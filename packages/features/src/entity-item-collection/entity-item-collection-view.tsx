import { useMemo, useState } from "react";
import {
  applyFilterValues,
  buildFilterProperties,
  extractFilterValuesFromCollectionUrl,
  findInvalidFilterKeys,
} from "@contentgrid/features/search";
import {
  type ProfileEntity,
  createValues,
  toProblemDisplayModel,
  useEntityItemCollection,
  useTypeahead,
} from "@contentgrid/navigator-data";
import { FilterSidebar, PageTitle } from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { BreadCrumbsToolBarLayout, EntityIconBadge, PageLayout } from "../layout";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

export interface EntityItemCollectionViewProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /** Fired when an entity item row is clicked; receives the item id. */
  readonly onEntityItemClick?: (itemId: string) => void;
  /**
   * Fired when the user paginates; receives the target page's href
   * (`collection.nextHref` / `collection.prevHref`).
   */
  readonly onPageChange?: (href: string | undefined) => void;
  /** Current filter values, keyed by search property name. Defaults to no filters applied. */
  readonly filters?: Record<string, string>;
  /** Fired when the user changes or clears a filter; receives the full next filters map. */
  readonly onFiltersChange?: (filters: Record<string, string>) => void;
}

/**
 * App-agnostic collection view: fetches the entity's items and renders the filter sidebar,
 * table, and pagination controls. All routing / navigation / page chrome is supplied by the
 * caller through `onEntityItemClick`, `onPageChange`, `onFiltersChange` — this component performs
 * no navigation itself and renders no toolbar/layout (see `EntityItemCollectionSearchView` for
 * that).
 */
export function EntityItemCollectionView({
  profile,
  pageUrl,
  onEntityItemClick,
  onPageChange,
  filters = {},
  onFiltersChange,
}: Readonly<EntityItemCollectionViewProps>) {
  const searchTemplate = profile.searchTemplate;
  const filterProperties = useMemo(
    () => (searchTemplate ? buildFilterProperties(searchTemplate) : []),
    [searchTemplate],
  );

  // undefined when there's no search template — same "disabled" signal the default (no
  // filters) mode already relied on before filtering existed, so an entity with no search
  // template behaves exactly as it did previously.
  const searchValues = useMemo(
    () =>
      searchTemplate
        ? applyFilterValues(createValues(searchTemplate.template), filterProperties, filters)
        : undefined,
    [searchTemplate, filterProperties, filters],
  );

  // `pageUrl`'s own query string carries whichever filters were active when it was fetched. If
  // that DIFFERS from the CURRENT filters (a deep link, or browser back/forward across a filter
  // change), `pageUrl` belongs to a different search — discard it so `searchValues` drives page 1
  // of the CURRENT filters instead, rather than silently fetching the wrong page.
  //
  // Both sides are compared post-encoding rather than as raw sidebar strings: `coerceFilterValue`
  // normalizes datetime and number inputs before they're encoded (dropping milliseconds,
  // canonicalizing "10.50" to "10.5", …), so a raw `filters` string and the value extracted back
  // out of an already-encoded `pageUrl` can legitimately represent the same filter while being
  // different strings. Running `filters` through the same HAL-FORMS encoder `searchValues` uses
  // (via `profile.searchEntityRequest`) before comparing avoids that mismatch.
  const pageUrlFilters = useMemo(
    () => (pageUrl ? extractFilterValuesFromCollectionUrl(filterProperties, pageUrl) : {}),
    [pageUrl, filterProperties],
  );
  const currentFilterParams = useMemo(
    () =>
      searchValues
        ? extractFilterValuesFromCollectionUrl(
            filterProperties,
            profile.searchEntityRequest(searchValues).url,
          )
        : {},
    [searchValues, filterProperties, profile],
  );
  const effectivePageUrl = recordsEqual(currentFilterParams, pageUrlFilters) ? pageUrl : undefined;
  const invalidFilterKeys = useMemo(
    () => findInvalidFilterKeys(filterProperties, filters),
    [filterProperties, filters],
  );

  // Only one field can be typeahead-active at a time (mirrors FilterSidebar's own
  // activeTypeaheadField contract) — switching fields just re-targets this single hook call
  // rather than needing one useTypeahead per property.
  const [activeTypeaheadField, setActiveTypeaheadField] = useState<string | undefined>(undefined);
  const typeahead = useTypeahead({
    profileEntity: profile,
    searchProperty: activeTypeaheadField
      ? searchTemplate?.getSearchPropertyByName(activeTypeaheadField)
      : undefined,
    searchValues,
    // No artificial minimum — suggestions should appear as soon as the user types anything.
    minLength: 1,
  });

  function handleTypeaheadSearch(fieldParam: string, query: string) {
    setActiveTypeaheadField(fieldParam);
    typeahead.setQuery(query);
  }

  const collection = useEntityItemCollection(
    effectivePageUrl
      ? { profileEntity: profile, url: effectivePageUrl }
      : { profileEntity: profile, searchValues },
  );

  // Pagination reset is the caller's responsibility here: a filter change is reported via
  // `onFiltersChange`, and the caller (the route) clears its own remembered page position — calling
  // `onPageChange` too would race with that.
  function handleFilterChange(key: string, value: string | undefined) {
    const next =
      value === undefined
        ? Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key))
        : { ...filters, [key]: value };
    onFiltersChange?.(next);
  }

  function handleClearAll() {
    onFiltersChange?.({});
    setActiveTypeaheadField(undefined);
  }

  const itemCountTitle = `${collection.data?.totalItems?.count ?? "-"} items ${collection.data?.totalItems?.isEstimated ? "(estimated)" : ""}`;

  return (
    <>
      <div className="p-4">
        <PageTitle
          header={"Entity Collection"}
          icon={<EntityIconBadge profile={profile} />}
          title={profile.pluralName}
          subtitle={itemCountTitle}
        />
      </div>

      <div className="flex gap-4 px-4 pb-4">
        {filterProperties.length > 0 && (
          <FilterSidebar
            filterProperties={filterProperties}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAll}
            invalidFilterKeys={invalidFilterKeys}
            onTypeaheadSearch={handleTypeaheadSearch}
            activeTypeaheadField={activeTypeaheadField}
            typeaheadSuggestions={typeahead.results.map((r) => r.value)}
            typeaheadIsLoading={typeahead.isLoading}
          />
        )}

        <div className="min-w-0 flex-1 space-y-4">
          {collection.isPending && <LoadingPage />}

          {collection.isError && <ErrorPage model={toProblemDisplayModel(collection.error)} />}

          {collection.isSuccess && (
            <EntityItemCollectionTable
              profile={profile}
              collection={collection.data}
              onEntityItemClick={onEntityItemClick}
              onPageChange={onPageChange}
            />
          )}
        </div>
      </div>
    </>
  );
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}
