import { type ReactNode, useCallback, useMemo, useState } from "react";
import { FunnelIcon as Funnel, SlidersHorizontalIcon } from "@phosphor-icons/react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  type EntityItemCollection,
  type FieldValue,
  type ProfileEntity,
  useEntityItemCollection,
  useTypeahead,
} from "@contentgrid/navigator-data";
import {
  AttributeMultiSelectContent,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type RecordTableSortOption,
} from "@contentgrid/ui";
import { type FieldState, resolveHalFormsFields } from "../hal-forms";
import { toAttributeOption, useColumnVisibility } from "../preferences";
import {
  buildCollectionSearchValues,
  encodeFilterValue,
  filterFieldValues,
} from "../search/filter-field-values";
import {
  extractFilterValuesFromCollectionUrl,
  findActivelyFilteredAttributeNames,
  findInvalidFilterKeys,
} from "../search/filter-properties";
import { EntityItemCollectionFilterDialog } from "./entity-item-collection-filter-dialog";

export interface EntityItemCollectionSearchOptions {
  readonly profile: ProfileEntity;
  /** URL of the collection page to display (a next/prev link); omitted = the first page. */
  readonly pageUrl?: string;
  /** Fired when the sort changes, with `undefined` to go back to the first page. */
  readonly onPageChange?: (href: string | undefined) => void;
  /** Current filter values, keyed by search property name. */
  readonly filters?: Record<string, string>;
  /** Fired with the full next filters map. The caller resets its own page position. */
  readonly onFiltersChange?: (filters: Record<string, string>) => void;
  /** Currently active sort value, e.g. `"name,asc"`. */
  readonly currentSort?: string;
  readonly onSortChange?: (sort: string | undefined) => void;
}

export interface EntityItemCollectionSearch {
  /** The collection query for the current page, filters and sort. */
  readonly collection: UseQueryResult<EntityItemCollection, Error>;
  /** The Columns and Filters buttons — `false` when there is nothing to offer. */
  readonly toolbarActions: ReactNode;
  /** The filters modal opened by the Filters button; render it once next to the table. */
  readonly filterDialog: ReactNode;
  /** Props for `EntityItemCollectionTable` that wire sorting and the column selection. */
  readonly tableProps: {
    readonly currentSort?: string;
    readonly onSort: (option: RecordTableSortOption | undefined) => void;
    readonly visibleColumnNames: readonly string[];
    readonly forcedVisibleColumnNames: readonly string[];
  };
}

/**
 * Search state shared by every collection list (the collection browser, the relation picker):
 * fetches the page for the current filters/sort and builds the session-local "Columns" picker,
 * the "Filters" button and its modal. Filters/sort/page live with the caller (URL state or local
 * state); this hook only derives from them and reports changes back.
 */
export function useEntityItemCollectionSearch(
  options: EntityItemCollectionSearchOptions,
): EntityItemCollectionSearch {
  const controls = useCollectionSearchControls(options);
  const collection = useEntityItemCollection(
    controls.effectivePageUrl
      ? { profileEntity: options.profile, url: controls.effectivePageUrl }
      : { profileEntity: options.profile, searchValues: controls.searchValues },
  );
  return controls.withCollection(collection);
}

/**
 * Everything but the fetch: the search values and page for the current filters/sort, and a
 * `withCollection` that builds the toolbar, filters modal and table props once the caller has
 * fetched the page those describe.
 */
function useCollectionSearchControls({
  profile,
  pageUrl,
  onPageChange,
  filters = EMPTY_FILTERS,
  onFiltersChange,
  currentSort,
  onSortChange,
}: EntityItemCollectionSearchOptions) {
  const searchTemplate = profile.searchTemplate;
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
  const searchValues = useMemo(
    () =>
      searchTemplate
        ? buildCollectionSearchValues(searchTemplate, fields, filters, currentSort)
        : undefined,
    [searchTemplate, fields, filters, currentSort],
  );

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
    () => (pageUrl ? extractFilterValuesFromCollectionUrl(fields, pageUrl) : {}),
    [pageUrl, fields],
  );
  const currentFilterParams = useMemo(
    () =>
      searchValues
        ? extractFilterValuesFromCollectionUrl(
            fields,
            profile.searchEntityRequest(searchValues).url,
          )
        : {},
    [searchValues, fields, profile],
  );
  const effectivePageUrl = recordsEqual(currentFilterParams, pageUrlFilters) ? pageUrl : undefined;
  const invalidFilterKeys = useMemo(
    () => new Set(findInvalidFilterKeys(fields, filters)),
    [fields, filters],
  );

  // Filters live in a modal (triggered from the toolbar) rather than an always-visible sidebar
  // — this just tracks whether that modal is open.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Attribute names the user is actively filtering on — always shown as columns regardless of
  // the local "Columns" selection below (see the union in EntityItemCollectionTable).
  const activelyFilteredAttributeNames = useMemo(
    () => (searchTemplate ? findActivelyFilteredAttributeNames(searchTemplate, filters) : []),
    [searchTemplate, filters],
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

  // Pagination reset is the caller's responsibility here: a filter change is reported via
  // `onFiltersChange`, and the caller (the route) clears its own remembered page position — calling
  // `onPageChange` too would race with that.
  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const next =
        value === undefined
          ? Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key))
          : { ...filters, [key]: value };
      onFiltersChange?.(next);
    },
    [filters, onFiltersChange],
  );

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
  // directions of that bridge — `filterFieldValues`/`encodeFilterValue` (in `../search/filter-field-values`) do the actual
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

  // Columns and Filters: right-aligned on the search bar's quick-filter row (or in the table's
  // toolbar when there is no search bar). Shown while the table loads or errors too.
  const toolbarActions = (attributeOptions.length > 0 || fields.length > 0) && (
    <>
      {attributeOptions.length > 0 && (
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
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
      {fields.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
          <Funnel aria-hidden />
          Filters
          {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
        </Button>
      )}
    </>
  );

  const withCollection = (
    collection: UseQueryResult<EntityItemCollection, Error>,
  ): EntityItemCollectionSearch => ({
    collection,
    toolbarActions,
    filterDialog: fields.length > 0 && (
      <EntityItemCollectionFilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeFilterCount={activeFilterCount}
        onClearAll={handleClearAll}
        fields={fields}
        layout={layout}
        values={values}
        onChange={handleHalFormChange}
        fieldState={fieldState}
        totalItems={collection.data?.totalItems}
        isLoading={collection.isFetching}
      />
    ),
    tableProps: {
      currentSort,
      onSort: handleSort,
      visibleColumnNames: localVisibleColumns,
      forcedVisibleColumnNames: activelyFilteredAttributeNames,
    },
  });

  return { searchValues, effectivePageUrl, withCollection };
}

const EMPTY_FILTERS: Record<string, string> = {};

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
