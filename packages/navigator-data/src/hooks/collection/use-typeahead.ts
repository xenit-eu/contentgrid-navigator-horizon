import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchHalSlice } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useDebouncedValue } from "../use-debounced-value";

export interface UseTypeaheadOptions {
  entityName: string;
  /**
   * Full URL of the collection to fetch suggestions from.
   *
   * For direct attribute fields (e.g. filterParam "number~prefix"):
   * pass the current entity's collection href.
   *
   * For relation traversal fields (e.g. "supplier.name~prefix" on invoices):
   * pass the RELATED entity's collection href and set filterParam to the
   * leaf attribute's prefix property on that collection. Querying the parent
   * entity's collection won't yield relation attribute values because parent
   * items do not embed the related entity's fields inline.
   */
  collectionHref: string;
  /**
   * The HAL-Forms search property name used as the URL query parameter.
   * Taken directly from _templates.search.properties[].name (e.g. "number~prefix",
   * "name~prefix"). The leaf field before "~" is used to extract values from
   * response items.
   */
  filterParam: string;
  /** Minimum input length before a request is fired. Defaults to 2. */
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

  // Derive the item field to read from: take everything before "~", then the
  // leaf segment. e.g. "number~prefix" → "number", "supplier.name~prefix" → "name".
  const baseField = filterParam.split("~")[0];
  const valueField = baseField.includes(".") ? baseField.split(".").pop()! : baseField;

  const enabled = debouncedQuery.length >= minLength;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.typeahead.byProperty(entityName, filterParam, debouncedQuery),
    queryFn: async () => {
      const url = new URL(collectionHref);
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
    // Use isFetching (not isLoading) so the flag stays true during background
    // refetches when keepPreviousData is serving stale placeholder results.
    isLoading: enabled && isFetching,
    search: setQuery,
  };
}
