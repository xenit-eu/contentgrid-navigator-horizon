import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchHalSlice } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { getBaseFieldName, getValueField } from "../../utils/search-property";
import { useNavigatorData } from "../context";
import { useDebouncedValue } from "../use-debounced-value";

export interface UseTypeaheadOptions {
  /**
   * Entity name (singular). Must match `profileEntity.name` — used as cache namespace.
   * For relation traversal, use the RELATED entity's name, not the source entity's.
   */
  entityName: string;
  /**
   * Collection URL to query for suggestions. Must be sourced from `profileEntity.collectionUrl`
   * (the `describes` collection link) — never constructed by string concatenation.
   *
   * For direct attribute fields (e.g. filterParam `"number~prefix-match"`):
   * pass the current entity's `profileEntity.collectionUrl`.
   *
   * For relation traversal (e.g. `"supplier.name~prefix-match"` on invoices):
   * pass the RELATED entity's `profileEntity.collectionUrl`. Querying the parent
   * entity's collection will not yield related-entity field values because parent
   * items do not embed related-entity fields inline.
   */
  collectionHref: string;
  /**
   * Search property name to filter on. Must be taken from
   * `profileEntity.searchTemplate.searchProperties[n].property.name`
   * (e.g. `"number~prefix-match"`) — never hardcoded.
   *
   * The leaf field name before `~` is derived automatically and used to
   * extract the matching string value from each response item.
   */
  filterParam: string;
  /** Minimum query length before a fetch fires. Defaults to 2. */
  minLength?: number;
}

export function useTypeahead({
  entityName,
  collectionHref,
  filterParam,
  minLength = 2,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const { apiFetch } = useNavigatorData();

  // getBaseFieldName strips "~operator", getValueField takes the leaf segment.
  // "number~prefix-match" → "number"; "supplier.name~prefix-match" → "name".
  const valueField = getValueField(getBaseFieldName(filterParam));

  // Guard on BOTH query and debouncedQuery:
  // - query prevents stale suggestions showing during the 250 ms debounce window
  //   after the user clears the field (results vanish immediately on clear).
  // - debouncedQuery prevents a fetch firing for a value that hasn't settled yet.
  const enabled = query.length >= minLength && debouncedQuery.length >= minLength;

  const { data, isFetching, isError, error } = useQuery({
    // collectionHref is included in the key so that the same entityName+filterParam+query
    // triple used against different collections (e.g. relation traversal) never collides.
    queryKey: queryKeys.typeahead.byProperty(
      entityName,
      collectionHref,
      filterParam,
      debouncedQuery,
    ),
    queryFn: async () => {
      // new URL(href, base) resolves relative hrefs (e.g. /invoices from collectionUrl)
      // correctly against the current origin; absolute hrefs ignore the base.
      const url = new URL(collectionHref, window.location.href);
      url.searchParams.set("size", "10");
      url.searchParams.set(filterParam, debouncedQuery);
      const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, new Request(url));
      const values = new Set<string>();
      for (const item of slice.items) {
        const val = item.data[valueField];
        if (typeof val === "string" && val.length > 0) values.add(val);
      }
      return [...values];
    },
    enabled,
    staleTime: 30_000,
    gcTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    results: enabled ? (data ?? []) : [],
    // isFetching (not isLoading) stays true during background refetches when
    // keepPreviousData is serving placeholder results.
    isLoading: enabled && isFetching,
    isError,
    error,
    search: setQuery,
  };
}
