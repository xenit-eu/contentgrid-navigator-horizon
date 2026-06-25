import { useState } from "react";
import { createValues } from "@contentgrid/hal-forms/values";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
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
   */
  searchProperty: SearchHalFormTemplateProperty;
  /** Minimum query length before a fetch fires. Defaults to 2. */
  minLength?: number;
}

export function useTypeahead({
  profileEntity,
  searchProperty,
  minLength = 2,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const searchTemplate = profileEntity.searchTemplate;

  // Guard on BOTH query and debouncedQuery:
  // - query prevents stale suggestions showing during the 250 ms debounce window
  //   after the user clears the field (results vanish immediately on clear).
  // - debouncedQuery prevents a fetch firing for a value that hasn't settled yet.
  const enabled = query.length >= minLength && debouncedQuery.length >= minLength;

  const searchValues =
    enabled && searchTemplate
      ? createValues(searchTemplate.template).withValue(
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
    { profileEntity, searchValues },
    { queryOptionsOverride: { staleTime: 30_000, gcTime: 60_000, retry: 0 } },
  );

  const attributeName = searchProperty.profileAttribute?.name;
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
    // isFetching (not isLoading) stays true during background refetches when
    // keepPreviousData is serving placeholder results.
    isLoading: enabled && isFetching,
    isError,
    error,
    search: setQuery,
  };
}
