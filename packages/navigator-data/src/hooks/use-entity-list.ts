import { useQuery } from "@tanstack/react-query";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHalSlice } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfile } from "./use-profile";

export interface EntityListParams {
  cursor?: string;
  size?: number;
  sort?: string;
  search?: string;
  searchField?: string;
  filters?: Record<string, string>;
}

export interface EntityListResult {
  items: Array<{
    data: Record<string, unknown>;
    selfHref: string;
    id: string;
    links: Record<string, unknown>;
  }>;
  totalItems?: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextHref?: string;
  prevHref?: string;
}

function buildCollectionUrl(collectionHref: string, params: EntityListParams): string {
  if (params.cursor) return params.cursor;
  const searchParams = new URLSearchParams();
  if (params.size != null) searchParams.set("size", String(params.size));
  if (params.sort) searchParams.set("_sort", params.sort);
  if (params.search && params.searchField) searchParams.set(params.searchField, params.search);
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) searchParams.set(key, value);
    }
  }
  const qs = searchParams.toString();
  return qs ? `${collectionHref}?${qs}` : collectionHref;
}

export async function fetchEntityList(
  apiFetch: Parameters<typeof fetchHalSlice>[0],
  collectionHref: string,
  params: EntityListParams,
): Promise<EntityListResult> {
  const url = buildCollectionUrl(collectionHref, params);
  const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, url);

  const items = slice.items.map((item) => {
    const selfLink = item.links.findLink(ianaRelations.self);
    const selfHref = selfLink?.href ?? "";
    const id = selfHref.split("/").pop() ?? "";
    const rawData = item.data as Record<string, unknown>;
    const links = (rawData._links as Record<string, unknown>) ?? {};
    return { data: { ...rawData }, selfHref, id, links };
  });

  // page lives in slice.data (the raw JSON payload), not as a direct property on HalSlice
  const pageData = (slice.data as Record<string, unknown>).page as
    | { total_items_exact?: number; total_items_estimate?: number }
    | undefined;

  return {
    items,
    totalItems: pageData?.total_items_exact ?? pageData?.total_items_estimate,
    hasNext: slice.next !== null,
    hasPrevious: slice.previous !== null,
    nextHref: slice.next?.href ?? undefined,
    prevHref: slice.previous?.href ?? undefined,
  };
}

export function useEntityList(entityName: string, params: EntityListParams) {
  const { apiFetch } = useNavigatorData();
  const { data: profile } = useProfile({ name: entityName });
  const collectionHref = profile?.collectionLink.href;

  return useQuery({
    queryKey: queryKeys.entityList(entityName, params as Record<string, unknown>),
    queryFn: () => fetchEntityList(apiFetch, collectionHref as string, params),
    enabled: !!entityName && !!collectionHref,
  });
}
