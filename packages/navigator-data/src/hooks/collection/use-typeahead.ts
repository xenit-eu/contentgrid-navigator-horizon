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
  /** The attribute field to prefix-search on and extract values from. */
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

  const prefixParam = `${attributeName}~prefix`;
  const enabled = debouncedQuery.length >= minLength;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.typeahead.byProperty(entityName, attributeName, debouncedQuery),
    queryFn: async () => {
      const url = new URL(collectionHref);
      url.searchParams.set("size", "10");
      url.searchParams.set(prefixParam, debouncedQuery);
      const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, new Request(url));
      const values = new Set<string>();
      for (const item of slice.items) {
        const val = item.data[attributeName];
        if (typeof val === "string" && val) values.add(val);
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
    isLoading: enabled && isLoading,
    search: setQuery,
  };
}
