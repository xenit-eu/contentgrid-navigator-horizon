import { type ReactNode, useMemo, useState } from "react";
import {
  applyFilterValues,
  buildFilterProperties,
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
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

export interface EntityItemCollectionViewProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /**
   * Render the breadcrumb toolbar on top; otherwise the content is wrapped in
   * a plain {@link PageLayout}. Defaults to `false`.
   */
  readonly toolbar?: boolean;
  /** Breadcrumb trail shown in the toolbar (only used when `toolbar` is true). */
  readonly breadcrumbs?: ReactNode;
  /** Actions / buttons shown at the end of the toolbar (only when `toolbar` is true). */
  readonly actions?: ReactNode;
  /** Fired when an entity item row is clicked; receives the item id. */
  readonly onEntityItemClick?: (itemId: string) => void;
  /**
   * Fired when the user paginates; receives the target page's href
   * (`collection.nextHref` / `collection.prevHref`).
   */
  readonly onPageChange?: (href: string | undefined) => void;
}

/**
 * App-agnostic collection view: fetches the entity's items and renders them as
 * a table, optionally inside a breadcrumb toolbar. All routing / navigation is
 * supplied by the caller through `onEntityItemClick`, `onPageChange` and
 * `breadcrumbs` — this component performs no navigation itself.
 */
export function EntityItemCollectionView({
  profile,
  pageUrl,
  toolbar = false,
  breadcrumbs,
  actions,
  onEntityItemClick,
  onPageChange,
}: Readonly<EntityItemCollectionViewProps>) {
  const [filters, setFilters] = useState<Record<string, string>>({});

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
    pageUrl ? { profileEntity: profile, url: pageUrl } : { profileEntity: profile, searchValues },
  );

  // A pageUrl encodes a specific (filtered) page — once the filters themselves change, that
  // page no longer corresponds to the new result set, so hand pagination back to page one
  // through the same callback the caller already uses to drive it.
  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => {
      if (value === undefined) {
        return Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key));
      }
      return { ...prev, [key]: value };
    });
    onPageChange?.(undefined);
  }

  function handleClearAll() {
    setFilters({});
    setActiveTypeaheadField(undefined);
    onPageChange?.(undefined);
  }

  const itemCountTitle = `${collection.data?.totalItems?.count ?? "-"} items ${collection.data?.totalItems?.isEstimated ? "(estimated)" : ""}`;

  const content = (
    <>
      <div className="p-4">
        <PageTitle
          header={"Entity Collection"}
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

  if (toolbar) {
    return (
      <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs} actions={actions}>
        {content}
      </BreadCrumbsToolBarLayout>
    );
  }
  // possibly here we should display the actions and breadcrumbs in a different way
  return <PageLayout>{content}</PageLayout>;
}
