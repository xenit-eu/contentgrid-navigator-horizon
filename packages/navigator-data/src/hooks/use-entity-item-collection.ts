import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import type ProfileEntity from "../accessors/entity-profile";
import type { SearchRequestSpec } from "../api/requests";
import { useNavigatorData } from "./context";

/**
 * Parameters for fetching a collection by URL.
 */
export interface EntityCollectionByUrl {
  /** Full collection URL (from search Request or next/prev links) */
  url: string;
  /** Entity profile for schema metadata */
  profileEntity: ProfileEntity;
}

/**
 * Parameters for fetching a collection by search values.
 */
export interface EntityCollectionBySearch {
  /** Entity profile with search template */
  profileEntity: ProfileEntity;
  /** Optional search parameters (filters, sort, pagination). Defaults to empty search. */
  searchValues?: HalFormValues<SearchRequestSpec>;
}

/**
 * Parameters for useEntityCollection hook.
 * Either provide a URL directly, or provide searchValues (or use default empty search).
 */
export type EntityCollectionParams = EntityCollectionByUrl | EntityCollectionBySearch;

/**
 * Type guard to check if params specify URL-based fetching.
 */
function isByUrl(params: EntityCollectionParams): params is EntityCollectionByUrl {
  return "url" in params;
}

/**
 * React hook to fetch and manage an entity collection.
 *
 * Supports two modes:
 * - **By URL**: Fetch a specific page using a cursor URL (from next/prev links or router params)
 * - **By Search**: Transform search values to a Request URL, then fetch (defaults to empty search)
 *
 * @param params - Either `{ url, profileEntity }` or `{ profileEntity, searchValues? }`
 * @returns TanStack Query result with EntityItemCollection data
 *
 * @example
 * ```typescript
 * // Default collection (empty search)
 * const { data: profile } = useProfileEntity({ name: "invoice" });
 * const { data: collection } = useEntityCollection({ profileEntity: profile! });
 *
 * // With search filters
 * const searchValues = createValues(profile.searchTemplate.template);
 * const { data: filtered } = useEntityCollection({
 *   profileEntity: profile!,
 *   searchValues
 * });
 *
 * // By URL (pagination)
 * const { data: nextPage } = useEntityCollection({
 *   url: collection.nextHref!,
 *   profileEntity: profile!
 * });
 * ```
 */
export function useEntityItemCollection(params: EntityCollectionParams) {
  const { apiFetch } = useNavigatorData();

  // URL-based fetch
  if (isByUrl(params)) {
    return useQuery({
      ...EntityItemCollection.fetchByUrlQuery(apiFetch, params.url, params.profileEntity),
    });
  }

  // Search-based fetch
  const searchTemplate = params.profileEntity?.searchTemplate;
  const searchValues =
    params.searchValues ?? (searchTemplate ? createValues(searchTemplate.template) : null);

  // Transform search values to Request URL
  const request = searchValues ? params.profileEntity.searchEntityRequest(searchValues) : null;

  return useQuery({
    ...EntityItemCollection.fetchByUrlQuery(
      apiFetch,
      request!.url, // TypeScript: guaranteed to exist when enabled=true
      params.profileEntity!,
    ),
    enabled: !!request,
  });
}

/**
 * React hook for infinite scroll / "load more" pattern.
 *
 * Supports two modes:
 * - **By URL**: Start infinite scroll from a specific URL
 * - **By Search**: Transform search values to initial URL (defaults to empty search)
 *
 * Fetches pages progressively using HAL next links. Each page is appended
 * to the previous pages, building up a continuous list.
 *
 * @param params - Either `{ url, profileEntity }` or `{ profileEntity, searchValues? }`
 * @returns TanStack Infinite Query result with pages array
 *
 * @example
 * ```typescript
 * // Default collection (empty search)
 * const { data: profile } = useProfileEntity({ name: "invoice" });
 * const { data, fetchNextPage, hasNextPage } = useEntityItemCollectionInfiniteScroll({
 *   profileEntity: profile!
 * });
 *
 * // With search filters
 * const searchValues = createValues(profile.searchTemplate.template);
 * const { data } = useEntityItemCollectionInfiniteScroll({
 *   profileEntity: profile!,
 *   searchValues
 * });
 *
 * // Start from specific URL
 * const { data } = useEntityItemCollectionInfiniteScroll({
 *   url: someUrl,
 *   profileEntity: profile!
 * });
 *
 * // Render all pages
 * return (
 *   <>
 *     {data?.pages.map((page, i) => (
 *       <Fragment key={i}>
 *         {page.items.map(item => <ItemCard key={item.id} item={item} />)}
 *       </Fragment>
 *     ))}
 *     {hasNextPage && (
 *       <button onClick={() => fetchNextPage()}>Load More</button>
 *     )}
 *   </>
 * );
 * ```
 */
export function useEntityItemCollectionInfiniteScroll(params: EntityCollectionParams) {
  const { apiFetch } = useNavigatorData();

  // URL-based fetch
  if (isByUrl(params)) {
    return useInfiniteQuery({
      ...EntityItemCollection.infiniteQuery(apiFetch, params.url, params.profileEntity),
    });
  }

  // Search-based fetch
  const searchTemplate = params.profileEntity?.searchTemplate;
  const searchValues =
    params.searchValues ?? (searchTemplate ? createValues(searchTemplate.template) : null);

  // Transform search values to Request URL
  const request = searchValues ? params.profileEntity.searchEntityRequest(searchValues) : null;

  return useInfiniteQuery({
    ...EntityItemCollection.infiniteQuery(
      apiFetch,
      request!.url, // TypeScript: guaranteed to exist when enabled=true
      params.profileEntity!,
    ),
    enabled: !!request,
  });
}
