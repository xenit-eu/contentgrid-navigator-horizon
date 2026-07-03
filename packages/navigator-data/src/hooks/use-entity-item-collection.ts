import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import type ProfileEntity from "../accessors/entity-profile";
import type { SearchRequestSpec } from "../api/requests";
import { resolveTrustedCollectionUrl } from "../search/cursor-trust";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";

export interface UseEntityItemCollectionOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
}

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
 * Parameters for fetching a collection with the template's default empty search.
 */
export interface EntityCollectionDefault {
  /** Entity profile with search template */
  profileEntity: ProfileEntity;
}

/**
 * Parameters for fetching a collection by explicit search values.
 * Query is disabled when searchValues is undefined.
 */
export interface EntityCollectionBySearch {
  /** Entity profile with search template */
  profileEntity: ProfileEntity;
  /** Search parameters (filters, sort, pagination). Query is disabled when undefined. */
  searchValues: HalFormValues<SearchRequestSpec> | undefined;
}

/**
 * Parameters for useEntityCollection hook.
 */
export type EntityCollectionParams =
  | EntityCollectionByUrl
  | EntityCollectionDefault
  | EntityCollectionBySearch;

/**
 * Type guard to check if params specify URL-based fetching.
 */
function isByUrl(params: EntityCollectionParams): params is EntityCollectionByUrl {
  return "url" in params;
}

function isBySearch(
  params: EntityCollectionDefault | EntityCollectionBySearch,
): params is EntityCollectionBySearch {
  return "searchValues" in params;
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
/**
 * Resolve the collection request URL and query-enabled flag from the params,
 * without calling any hooks. Shared by both collection hooks so each can call
 * its TanStack hook exactly once, unconditionally (rules-of-hooks safe).
 *
 * @param apiBaseUrl - Absolute API base URL (the trusted `profileUrl` from
 *   `useNavigatorData()`), used as the trust anchor for by-url requests. It is
 *   always absolute, unlike `profileEntity.collectionUrl` which may be a
 *   relative path — anchoring on a relative URL would make `new URL(...)`
 *   throw for every cursor and silently disable pagination entirely.
 */
function resolveCollectionRequest(
  params: EntityCollectionParams,
  apiBaseUrl: string,
): {
  url: string;
  enabled: boolean;
} {
  // URL-based fetch: only trust URLs that resolve to the same origin as the
  // trusted API base. A caller-supplied cursor (e.g. from bookmarked or
  // crafted URL state) could otherwise point apiFetch — which unconditionally
  // attaches the bearer token — at an attacker-controlled origin. Discard and
  // fall back to the normal first-page request instead of throwing.
  if (isByUrl(params)) {
    const trustedUrl = resolveTrustedCollectionUrl(params.url, apiBaseUrl);
    if (trustedUrl !== null) {
      return { url: trustedUrl, enabled: true };
    }
    return resolveCollectionRequest({ profileEntity: params.profileEntity }, apiBaseUrl);
  }

  let request: ReturnType<ProfileEntity["searchEntityRequest"]> | null;
  if (isBySearch(params)) {
    // Search-based fetch: undefined → disabled, explicit values → fetch.
    request = params.searchValues
      ? params.profileEntity.searchEntityRequest(params.searchValues)
      : null;
  } else {
    // Default fetch: use the template's empty search (null when no search template).
    const searchTemplate = params.profileEntity.searchTemplate;
    request = searchTemplate
      ? params.profileEntity.searchEntityRequest(createValues(searchTemplate.template))
      : null;
  }

  return { url: request?.url ?? "", enabled: !!request };
}

export function useEntityItemCollection(
  params: EntityCollectionParams,
  options?: UseEntityItemCollectionOptions,
) {
  const { apiFetch, profileUrl } = useNavigatorData();
  const { url, enabled } = resolveCollectionRequest(params, profileUrl);

  return useQuery({
    ...EntityItemCollection.fetchByUrlQuery(
      apiFetch,
      url,
      params.profileEntity,
      options?.queryOptionsOverride,
    ),
    enabled,
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
export function useEntityItemCollectionInfiniteScroll(
  params: EntityCollectionParams,
  options?: UseEntityItemCollectionOptions,
) {
  const { apiFetch, profileUrl } = useNavigatorData();
  const { url, enabled } = resolveCollectionRequest(params, profileUrl);

  return useInfiniteQuery({
    ...EntityItemCollection.infiniteQuery(
      apiFetch,
      url,
      params.profileEntity,
      options?.queryOptionsOverride,
    ),
    enabled,
  });
}
