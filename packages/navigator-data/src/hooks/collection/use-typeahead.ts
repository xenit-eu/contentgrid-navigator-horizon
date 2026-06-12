import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchHalSlice } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useDebouncedValue } from "../use-debounced-value";

export interface UseTypeaheadOptions {
  entityName: string;
  /** Full collection URL obtained from the HAL profile's describes link. */
  collectionHref: string;
  /**
   * The attribute name to prefix-search on and extract values from.
   * Supports dot-notation (e.g. "document.title") — the leaf field is used
   * for value extraction from the response items.
   */
  attributeName: string;
  /** Minimum input length before a request is fired. Defaults to 2. */
  minLength?: number;
}

export function useTypeahead({
  entityName,
  collectionHref,
  attributeName,
  minLength = 2,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const { apiFetch } = useNavigatorData();

  // For dot-notation paths (e.g. "document.title"), the HAL item stores the leaf
  // field as a top-level key — extract it for response value reading.
  const leafField = attributeName.includes(".") ? attributeName.split(".").pop()! : attributeName;
  const prefixParam = `${attributeName}~prefix`;
  const enabled = debouncedQuery.length >= minLength;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.typeahead.byProperty(entityName, attributeName, debouncedQuery),
    queryFn: async () => {
      const url = new URL(collectionHref);
      url.searchParams.set("size", "10");
      url.searchParams.set(prefixParam, debouncedQuery);
      const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, new Request(url));
      const values = new Set<string>();
      for (const item of slice.items) {
        const val = item.data[leafField];
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
