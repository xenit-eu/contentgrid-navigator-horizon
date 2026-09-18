import { useCallback, useMemo, useState } from "react";
import { FunnelIcon as Funnel, SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  EntityItem,
  type FieldValue,
  type ProfileEntity,
  createValues,
  toProblemDisplayModel,
  useEntityItemCollection,
  useTypeahead,
} from "@contentgrid/navigator-data";
import {
  AttributeMultiSelectContent,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type RecordTableSortOption,
} from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import {
  type FieldState,
  HalFormsContainer,
  type HalFormsField,
  resolveHalFormsFields,
} from "../hal-forms";
import { EntityIconBadge } from "../layout";
import { toAttributeOption, useColumnVisibility } from "../preferences";
import {
  applyFilterValues,
  buildFilterProperties,
  coerceFilterValue,
  extractFilterValuesFromCollectionUrl,
  findActivelyFilteredAttributeNames,
  findInvalidFilterKeys,
} from "../search/filter-properties";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

export interface EntityItemCollectionViewProps {
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
 * navigation itself and renders no toolbar/layout (see `EntityItemCollectionSearchView` for
 * that).
 *
 * Filters render through `@contentgrid/features/hal-forms`'s generic `HalFormsContainer` rather
 * than the earlier `FilterSidebar` pattern (`@contentgrid/ui`) — `resolveHalFormsFields` derives
 * the same two-column layout and field kinds (including `autocomplete` for a prefix/full-text
 * search property) directly from the search template. `filterProperties`
 * (`../search/filter-properties`'s `SearchFilterProperty[]`) is still the encoding/decoding
 * source of truth for the raw `filters: Record<string, string>` contract this view's own
 * caller-facing props keep (URL-state-backed, per `filter-url-state.ts`) — only the RENDERING
 * moved, not how a filter value round-trips to/from a HAL-FORMS request. `FilterSidebar` itself
 * is now unused by this view; it's fine to remove it or its own `TypeaheadTextFilter` next, but
 * neither is touched here.
 */
export function EntityItemCollectionView({
  profile,
  pageUrl,
  onEntityItemClick,
  onPageChange,
  filters = {},
  onFiltersChange,
  currentSort,
  onSortChange,
}: Readonly<EntityItemCollectionViewProps>) {
  const searchTemplate = profile.searchTemplate;
  const filterProperties = useMemo(
    () => (searchTemplate ? buildFilterProperties(searchTemplate) : []),
    [searchTemplate],
  );
  const { fields, layout } = useMemo(
    () =>
      searchTemplate
        ? resolveHalFormsFields(searchTemplate)
        : { fields: [], layout: { sections: [] } },
    [searchTemplate],
  );

  // undefined when there's no search template — same "disabled" signal the default (no
  // filters) mode already relied on before filtering existed, so an entity with no search
  // template behaves exactly as it did previously.
  const searchValues = useMemo(() => {
    if (!searchTemplate) return undefined;
    const filtered = applyFilterValues(
      createValues(searchTemplate.template),
      filterProperties,
      filters,
    );
    // `_sort` is always multi-value — pass a single-element array, never a plain string.
    return currentSort && searchTemplate.sortProperty
      ? filtered.withValue(searchTemplate.sortProperty.name, [currentSort])
      : filtered;
  }, [searchTemplate, filterProperties, filters, currentSort]);

  // `pageUrl`'s own query string carries whichever filters were active when it was fetched. If
  // that DIFFERS from the CURRENT filters (a deep link, or browser back/forward across a filter
  // change), `pageUrl` belongs to a different search — discard it so `searchValues` drives page 1
  // of the CURRENT filters instead, rather than silently fetching the wrong page.
  //
  // Both sides are compared post-encoding rather than as raw filter-form strings: `coerceFilterValue`
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
    () => new Set(findInvalidFilterKeys(filterProperties, filters)),
    [filterProperties, filters],
  );

  // Filters live in a modal (triggered from the toolbar) rather than an always-visible sidebar
  // — this just tracks whether that modal is open.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Attribute names the user is actively filtering on — always shown as columns regardless of
  // the local "Columns" selection below (see the union in EntityItemCollectionTable).
  const activelyFilteredAttributeNames = useMemo(
    () => findActivelyFilteredAttributeNames(filterProperties, filters),
    [filterProperties, filters],
  );

  // A local, session-only "Columns" selector next to Filters — lets the user adjust visible
  // columns for just this table view without touching persisted preferences (that's what
  // `~configuration/$entity`'s "Visible columns" picker is for). Seeded once, on mount, from the
  // currently persisted columns via a lazy initializer — it deliberately does NOT re-sync if the
  // persisted preference changes later, so a user's in-progress local edits aren't silently
  // overwritten mid-session. The route remounts this view per entity (`key={profile.name}`), so
  // switching entities naturally resets this back to the new entity's persisted default — no
  // extra reset effect needed here.
  const persistedVisibility = useColumnVisibility(profile);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [localVisibleColumns, setLocalVisibleColumns] = useState<readonly string[]>(
    () => persistedVisibility.visibleColumns,
  );
  const attributeOptions = useMemo(
    () => [
      ...[profile.idAttribute, ...profile.userDefinedAttributes].map((attribute) =>
        toAttributeOption(attribute, false),
      ),
      ...profile.auditAttributes.map((attribute) => toAttributeOption(attribute, true)),
    ],
    [profile],
  );

  // Only one field can be typeahead-active at a time (mirrors the search page owning a single
  // useTypeahead call and handing its live results down to whichever autocomplete field is
  // currently active, rather than the generic renderer fetching anything itself — see
  // `HalFormsFieldRenderer`'s own doc comment) — switching fields just re-targets this one hook
  // call rather than needing one useTypeahead per property.
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

  // Stable (setState setters never change identity) so it can be a correct, complete dependency
  // of the `fieldState` memo below without defeating that memo's own point.
  const handleTypeaheadSearch = useCallback(
    (fieldParam: string, query: string) => {
      setActiveTypeaheadField(fieldParam);
      typeahead.setQuery(query);
    },
    [typeahead.setQuery],
  );

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

  // A sort change invalidates whatever page cursor was in flight the same way a filter change
  // does — hand pagination back to page one via the same callback.
  function handleSort(option: RecordTableSortOption | undefined) {
    onSortChange?.(option?.value);
    onPageChange?.(undefined);
  }

  // `HalFormsContainer`'s widgets work with typed `FieldValue`s; `filters` (this view's own
  // caller-facing contract) is plain strings. `values`/`handleHalFormChange` are the two
  // directions of that bridge — `filterFieldValues`/`encodeFilterValue` below do the actual
  // per-kind conversion, reusing `coerceFilterValue` (keyed off `field.property.type`, the raw
  // wire type every `HalFormsField` still carries) for the string -> typed direction so the
  // coercion rules stay identical to what `applyFilterValues`/`searchValues` above already use.
  const values = useMemo(() => filterFieldValues(fields, filters), [fields, filters]);

  function handleHalFormChange(name: string, value: FieldValue) {
    handleFilterChange(name, encodeFilterValue(value));
  }

  const fieldState = useMemo(() => {
    const state: Record<string, FieldState> = {};
    for (const field of fields) {
      const errors: FieldState["errors"] = invalidFilterKeys.has(field.name)
        ? [{ source: "client", message: invalidFilterValueMessage(field.property.type) }]
        : [];
      if (field.kind === "autocomplete") {
        const isActive = activeTypeaheadField === field.name;
        state[field.name] = {
          errors,
          autocomplete: {
            suggestions: isActive ? typeahead.results.map((r) => r.value) : [],
            isLoading: isActive && typeahead.isLoading,
            onQueryChange: (query) => handleTypeaheadSearch(field.name, query),
          },
        };
      } else if (errors.length > 0) {
        state[field.name] = { errors };
      }
    }
    return state;
  }, [
    fields,
    invalidFilterKeys,
    activeTypeaheadField,
    typeahead.results,
    typeahead.isLoading,
    handleTypeaheadSearch,
  ]);

  const itemCountTitle = `${collection.data?.totalItems?.count ?? "-"} items ${collection.data?.totalItems?.isEstimated ? "(estimated)" : ""}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-4">
        <PageTitle
          header={"Entity Collection"}
          icon={<EntityIconBadge profile={profile} />}
          title={profile.pluralName}
          subtitle={itemCountTitle}
        />
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4">
        {collection.isPending && <LoadingPage />}

        {collection.isError && <ErrorPage model={toProblemDisplayModel(collection.error)} />}

        {collection.isSuccess && (
          <EntityItemCollectionTable
            className="h-full"
            profile={profile}
            collection={collection.data}
            onEntityItemClick={onEntityItemClick}
            onPageChange={onPageChange}
            currentSort={currentSort}
            onSort={handleSort}
            visibleColumnNames={localVisibleColumns}
            forcedVisibleColumnNames={activelyFilteredAttributeNames}
            tableActions={
              (attributeOptions.length > 0 || filterProperties.length > 0) && (
                <>
                  {attributeOptions.length > 0 && (
                    <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <SlidersHorizontalIcon aria-hidden />
                          Columns
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-1" align="end">
                        <AttributeMultiSelectContent
                          attributes={attributeOptions}
                          values={localVisibleColumns}
                          onChange={setLocalVisibleColumns}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {filterProperties.length > 0 && (
                    <Button variant="outline" onClick={() => setFiltersOpen(true)}>
                      <Funnel aria-hidden />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary">{activeFilterCount}</Badge>
                      )}
                    </Button>
                  )}
                </>
              )
            }
          />
        )}
      </div>

      {filterProperties.length > 0 && (
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">Filters</DialogTitle>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-sm text-muted-foreground"
                  onClick={handleClearAll}
                >
                  Clear all
                </Button>
              )}
            </div>
            <HalFormsContainer
              fields={fields}
              layout={layout}
              values={values}
              onChange={handleHalFormChange}
              fieldState={fieldState}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Empty-state default per `HalFormsField.kind`, mirroring `entity-item-create`'s
 * `defaultValueFor` — used only when a filter is entirely absent, never for a present-but-empty
 * one (there is no such state: an empty raw value is normalized away by `handleFilterChange`). */
function emptyValueFor(field: HalFormsField): FieldValue {
  if (field.kind === "boolean" || field.kind === "file") return undefined;
  if ((field.kind === "enum" || field.kind === "autocomplete") && field.multiValue) return [];
  return "";
}

/** String `filters` -> typed `FieldValue`s for `HalFormsContainer`'s `values` prop, reusing
 * `coerceFilterValue` (keyed off the raw wire type every `HalFormsField.property` still carries)
 * for a present, non-empty raw value. */
function filterFieldValues(
  fields: readonly HalFormsField[],
  filters: Record<string, string>,
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw = filters[field.name];
    values[field.name] = raw ? coerceFilterValue(field.property.type, raw) : emptyValueFor(field);
  }
  return values;
}

/** Inverse of `filterFieldValues`, for `HalFormsContainer`'s `onChange`. */
function encodeFilterValue(value: FieldValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  if (typeof value === "string") return value === "" ? undefined : value;
  return String(value);
}

/** Mirrors the former `filter-sidebar.tsx`'s module-private `invalidValueMessage` — same
 * wire-type-keyed messages, now surfaced through `HalFormsFieldRenderer`'s own error prop
 * instead of `FilterSidebar`'s bespoke `invalidFilterKeys` handling. */
function invalidFilterValueMessage(propertyType: string): string {
  switch (propertyType) {
    case "number":
    case "range":
      return "Enter a valid number";
    case "date":
      return "Enter a valid date";
    case "datetime":
    case "datetime-local":
      return "Enter a valid date and time";
    default:
      return "Enter a valid value";
  }
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}
