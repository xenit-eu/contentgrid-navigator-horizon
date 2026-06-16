import { useQuery } from "@tanstack/react-query";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import { createValues } from "@contentgrid/hal-forms/values";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHalSlice } from "../api/hal-client";
import type { SearchTemplate } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useEntitySchema } from "./use-entity-schema";
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

/**
 * Collects the search-affecting params as [property, value] entries in the
 * shape of the profile's `search` template properties (`_sort`, search params,
 * exact-match filters). Empty values are skipped.
 */
function activeSearchEntries(params: EntityListParams): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (params.sort) entries.push(["_sort", params.sort]);
  if (params.search && params.searchField) entries.push([params.searchField, params.search]);
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value) entries.push([key, value]);
  }
  return entries;
}

/**
 * Appends the first-page `size` param. The platform documents `size` as a
 * pagination query param on the first page, distinct from the search form,
 * so it is set on the final URL rather than through the search template.
 */
function withSizeParam(url: string, size?: number): string {
  if (size == null) return url;
  const sized = new URL(url);
  sized.searchParams.set("size", String(size));
  return sized.href;
}

/**
 * Encodes the active search params through the profile's `search` template
 * (HAL-FORMS GET form) using the hal-forms codecs — never by hand-building
 * query strings (affordance rule 7). Params that are not properties of the
 * template are skipped: the template is the contract for what is searchable.
 * When the profile exposes no search template, search is not permitted
 * (affordance rule 2) and the plain collection URL is used.
 */
function encodeSearchUrl(
  collectionHref: string,
  params: EntityListParams,
  searchTemplate: SearchTemplate | null,
): string {
  const entries = activeSearchEntries(params);
  if (entries.length === 0 || searchTemplate === null) {
    return withSizeParam(collectionHref, params.size);
  }

  const supported = new Set(searchTemplate.properties.map((p) => p.name));
  let values = createValues(searchTemplate);
  for (const [name, value] of entries) {
    if (supported.has(name)) {
      values = values.withValue(name, value);
    }
  }

  // The codec encodes GET form values onto the template target's query string.
  const request = halFormCodecs.requireCodecFor(searchTemplate).encode(values);
  return withSizeParam(request.url, params.size);
}

/**
 * Legacy first-page URL construction via a hand-built query string — only for
 * fetchEntityList callers not yet migrated to the search template
 * (use-cross-entity-search, use-recent-items, use-recent-activity,
 * use-entity-status-breakdown). Migrate those to pass a resolved search
 * template to {@link fetchEntityList} and remove this (affordance rule 7).
 */
function buildLegacyCollectionUrl(collectionHref: string, params: EntityListParams): string {
  const searchParams = new URLSearchParams();
  if (params.size != null) searchParams.set("size", String(params.size));
  for (const [key, value] of activeSearchEntries(params)) {
    searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  return qs ? `${collectionHref}?${qs}` : collectionHref;
}

function buildCollectionUrl(
  collectionHref: string,
  params: EntityListParams,
  searchTemplate?: SearchTemplate | null,
): string {
  // Cursor params are full hrefs from HAL next/prev links — follow them verbatim.
  if (params.cursor) return params.cursor;
  if (searchTemplate === undefined) return buildLegacyCollectionUrl(collectionHref, params);
  return encodeSearchUrl(collectionHref, params, searchTemplate);
}

export async function fetchEntityList(
  apiFetch: Parameters<typeof fetchHalSlice>[0],
  collectionHref: string,
  params: EntityListParams,
  searchTemplate?: SearchTemplate | null,
): Promise<EntityListResult> {
  const url = buildCollectionUrl(collectionHref, params, searchTemplate);
  const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, url);

  const items = slice.items.map((item) => {
    const selfLink = item.links.findLink(ianaRelations.self);
    const selfHref = selfLink?.href ?? "";
    const rawData = item.data as Record<string, unknown>;

    // Entity-item responses expose id as a top-level JSON field per the HAL contract.
    // Fall back to last URL path segment only if the field is genuinely absent
    // (should not happen on a well-formed ContentGrid response).
    const id =
      typeof rawData.id === "string" && rawData.id ? rawData.id : (selfHref.split("/").pop() ?? "");

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
  const { data: entities } = useProfile();
  // Match by link name (singular entity name from the profile root cg:entity link).
  // No longer falls back to last path segment of href — name is always present on
  // well-formed ContentGrid profile roots.
  const entity = entities?.find((e) => e.name === entityName);
  const collectionHref = entity?.collectionHref;

  // The search template is only needed for first-page requests with active
  // search params; cursor pages follow the HAL next/prev href verbatim.
  const needsSearchTemplate = !params.cursor && activeSearchEntries(params).length > 0;
  const schemaQuery = useEntitySchema(entityName, { enabled: needsSearchTemplate });
  // On schema error, use `undefined` (not `null`) so buildCollectionUrl routes
  // through buildLegacyCollectionUrl, which still appends active filters as raw
  // query params. `null` would route through encodeSearchUrl which strips all
  // filters, producing an unfiltered list cached under a key that says filtered.
  const searchTemplate = schemaQuery.isError
    ? undefined
    : (schemaQuery.data?.searchTemplate ?? null);
  // Wait for the template before a search request; when the schema fetch
  // errored, degrade to the legacy filter path rather than blocking forever.
  const searchTemplateReady = needsSearchTemplate ? schemaQuery.isFetched : true;

  return useQuery({
    queryKey: queryKeys.entityList(entityName, params as Record<string, unknown>),
    queryFn: () => fetchEntityList(apiFetch, collectionHref as string, params, searchTemplate),
    enabled: !!entityName && !!collectionHref && searchTemplateReady,
  });
}
