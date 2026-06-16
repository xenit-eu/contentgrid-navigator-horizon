import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchHal } from "../api/hal-client";
import type { EntitySchema } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

// import { useProfile } from "./use-profile-entity";

interface StatusBreakdownResult {
  attribute: string;
  breakdown: Array<{ value: string; count: number }>;
  isLoading: boolean;
}

export function useEntityStatusBreakdown(
  entityName: string,
  schema: EntitySchema | null,
): StatusBreakdownResult {
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfile();
  const collectionHref = entities?.find((e) => e.name === entityName)?.collectionHref;

  const enumAttr = useMemo(
    () => schema?.attributes.find((a) => a.allowedValues && a.allowedValues.length > 0) ?? null,
    [schema],
  );

  const values = useMemo(() => enumAttr?.allowedValues ?? [], [enumAttr]);

  const queries = useQueries({
    queries: values.map((value) => ({
      queryKey: queryKeys.entityList(entityName, {
        size: 0,
        search: value,
        searchField: enumAttr!.name,
      }),
      queryFn: async () => {
        const params = new URLSearchParams();
        params.set("size", "0");
        params.set(enumAttr!.name, value);
        const { object } = await fetchHal<Record<string, unknown>>(
          apiFetch,
          `${collectionHref}?${params.toString()}`,
        );
        const page = object.data.page as
          | { total_items_exact?: number; total_items_estimate?: number }
          | undefined;
        return page?.total_items_exact ?? page?.total_items_estimate ?? 0;
      },
      enabled: !!enumAttr && !!entityName && !!collectionHref,
    })),
  });

  const breakdown = useMemo(() => {
    if (!enumAttr) return [];
    return values.map((value, i) => ({ value, count: (queries[i]?.data as number) ?? 0 }));
  }, [enumAttr, values, queries]);

  return {
    attribute: enumAttr?.title ?? "",
    breakdown: enumAttr ? breakdown : [],
    isLoading: queries.some((q) => q.isLoading),
  };
}
