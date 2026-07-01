import { useState } from "react";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { createValues } from "@contentgrid/hal-forms/values";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import type { SearchRequestSpec } from "../../api/requests";
import { useDebouncedValue } from "../use-debounced-value";
import { useEntityItemCollection } from "./use-entity-item-collection";

export interface UseTypeaheadOptions {
  /**
   * The profile entity whose collection is queried for suggestions.
   *
   * For direct attribute fields (e.g. `number~prefix` on invoices):
   * pass the invoice `profileEntity`.
   *
   * For relation traversal (e.g. `name~prefix` on a related supplier):
   * pass the RELATED entity's `profileEntity`. The related entity's collection
   * is queried because the parent entity items do not embed related-entity fields inline.
   */
  profileEntity: ProfileEntity;
  /**
   * A search property from `profileEntity.searchTemplate`.
   * Provides the filter parameter name and the attribute to extract from each result.
   * Obtain via `searchTemplate.getSearchPropertiesByType(...)` or `getSearchPropertyByName(...)`.
   * When undefined (e.g. no field is active yet), the hook returns empty results without fetching.
   */
  searchProperty?: SearchHalFormTemplateProperty;
  /** Minimum query length before a fetch fires. Defaults to 2. */
  minLength?: number;
  /**
   * Existing search values to include in each typeahead query.
   * The typeahead prefix filter is merged on top of these values so
   * suggestions are scoped to the current active filters.
   * Build from `searchTemplate.template` via `createValues(...).withValue(...)`.
   */
  searchValues?: HalFormValues<SearchRequestSpec>;
}

export function useTypeahead({
  profileEntity,
  searchProperty,
  minLength = 2,
  searchValues,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const searchTemplate = profileEntity.searchTemplate;

  // Both must meet minLength: query clears results instantly on empty; debouncedQuery gates the fetch.
  // Also disabled when no searchProperty is active yet.
  const enabled =
    !!searchProperty && query.length >= minLength && debouncedQuery.length >= minLength;

  const collectionSearchValues =
    enabled && searchTemplate && searchProperty
      ? (searchValues ?? createValues(searchTemplate.template)).withValue(
          searchProperty.property.name,
          debouncedQuery,
        )
      : undefined;

  const {
    data: entityItemCollection,
    isFetching,
    isError,
    error,
  } = useEntityItemCollection(
    { profileEntity, searchValues: collectionSearchValues },
    { queryOptionsOverride: { staleTime: 30_000, gcTime: 60_000, retry: 0 } },
  );

  const attributeName = searchProperty?.profileAttribute?.name;
  const suggestions: string[] = [];
  if (entityItemCollection && attributeName) {
    const found = new Set<string>();
    for (const item of entityItemCollection.items) {
      const val = item.halItem.data[attributeName];
      if (typeof val === "string" && val.length > 0) found.add(val);
    }
    suggestions.push(...found);
  }

  return {
    results: enabled ? suggestions : [],
    isLoading: enabled && isFetching, // isFetching stays true during background refetches; isLoading would not
    isError,
    error,
    search: setQuery,
  };
}
