import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TypedFetch } from "../api/client";
import { fetchHalSlice } from "../api/hal-client";
import type { SearchProperty } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

export interface UseSearchSuggestionsOptions {
  entityName: string;
  /** Full collection URL, e.g. https://api.example.com/invoices */
  collectionHref: string;
  searchProperties: SearchProperty[];
  activeField: string;
  query: string;
}

const DATE_FIELD_TYPES = new Set(["date", "datetime", "datetime-local", "time"]);
const DATE_SUFFIXES = ["~before", "~after"];

type SuggestionStrategy =
  | { type: "inline"; values: string[] } // values extracted from OptionEntry[]
  | { type: "prefix"; fieldParam: string; valueField: string }
  | { type: "exact"; valueField: string }
  | { type: "none" };

function isDateField(prop: SearchProperty): boolean {
  if (DATE_FIELD_TYPES.has(prop.type)) return true;
  return DATE_SUFFIXES.some((s) => prop.name.endsWith(s));
}

function getSuggestionStrategy(
  activeField: string,
  searchProperties: SearchProperty[],
): SuggestionStrategy {
  const activeProp = searchProperties.find((p) => p.name === activeField);
  if (!activeProp) return { type: "none" };
  if (isDateField(activeProp)) return { type: "none" };
  if (activeProp.options?.inline?.length) {
    // OptionEntry[] — extract the value strings for suggestion matching
    return { type: "inline", values: activeProp.options.inline.map((e) => e.value) };
  }
  if (activeField.includes("~prefix")) {
    const baseField = activeField.split("~")[0];
    const valueField = baseField.includes(".") ? baseField.split(".").pop()! : baseField;
    return { type: "prefix", fieldParam: activeField, valueField };
  }
  const prefixVariant = searchProperties.find((p) => p.name === `${activeField}~prefix`);
  if (prefixVariant) {
    return { type: "prefix", fieldParam: prefixVariant.name, valueField: activeField };
  }
  const valueField = activeField.includes(".") ? activeField.split(".").pop()! : activeField;
  return { type: "exact", valueField };
}

async function fetchItemValues(
  apiFetch: TypedFetch,
  collectionHref: string,
  valueField: string,
  filterParam?: string,
  filterValue?: string,
  size = 10,
): Promise<string[]> {
  const searchParams = new URLSearchParams({ size: String(size) });
  if (filterParam && filterValue) searchParams.set(filterParam, filterValue);

  const slice = await fetchHalSlice<Record<string, unknown>>(
    apiFetch,
    `${collectionHref}?${searchParams.toString()}`,
  );
  const values = new Set<string>();
  for (const item of slice.items) {
    const val = item.data[valueField];
    if (typeof val === "string" && val) values.add(val);
  }
  return [...values];
}

export function useSearchSuggestions({
  entityName,
  collectionHref,
  searchProperties,
  activeField,
  query,
}: UseSearchSuggestionsOptions) {
  const { apiFetch } = useNavigatorData();
  const strategy = getSuggestionStrategy(activeField, searchProperties);

  const inlineSuggestions =
    strategy.type === "inline"
      ? strategy.values.filter((v) => v.toLowerCase().includes(query.toLowerCase()))
      : [];

  const needsPrefixCall = strategy.type === "prefix" && query.length >= 2;
  const needsExactCall = strategy.type === "exact";

  const { data: prefixSuggestions, isLoading: prefixLoading } = useQuery({
    queryKey: queryKeys.searchSuggestions(entityName, activeField, query),
    queryFn: () => {
      const s = strategy as Extract<SuggestionStrategy, { type: "prefix" }>;
      return fetchItemValues(apiFetch, collectionHref, s.valueField, s.fieldParam, query, 10);
    },
    enabled: needsPrefixCall,
    staleTime: 30_000,
    gcTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: exactValues, isLoading: exactLoading } = useQuery({
    queryKey: queryKeys.searchSuggestions(entityName, activeField, ""),
    queryFn: () => {
      const s = strategy as Extract<SuggestionStrategy, { type: "exact" }>;
      return fetchItemValues(apiFetch, collectionHref, s.valueField, undefined, undefined, 20);
    },
    enabled: needsExactCall,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  if (strategy.type === "inline" && query.length >= 1) {
    return { suggestions: inlineSuggestions, isLoading: false };
  }
  if (strategy.type === "prefix") {
    return {
      suggestions: needsPrefixCall ? (prefixSuggestions ?? []) : [],
      isLoading: needsPrefixCall && prefixLoading,
    };
  }
  if (strategy.type === "exact" && query.length >= 1) {
    const filtered = (exactValues ?? []).filter((v) =>
      v.toLowerCase().includes(query.toLowerCase()),
    );
    return { suggestions: filtered, isLoading: exactLoading };
  }
  return { suggestions: [], isLoading: false };
}
