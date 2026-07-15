import { type QueryClient, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import type ProfileEntity from "../accessors/entity-profile";
import type { TypedFetch } from "../api/client";
import type { SearchRequestSpec } from "../api/requests";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";

export interface UseEntityItemCollectionOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
}

/**
 * Parameters for fetching a collection with the template's default empty search.
 * `searchParams` carries the route's `cursor` value (if present) as a standard
 * `URLSearchParams` — the caller builds it from the route's validated search
 * state; it's re-attached to the search URL as `_cursor`.
 */
export interface EntityCollectionDefault {
  /** Entity profile with search template */
  profileEntity: ProfileEntity;
  /** URLSearchParams carrying `cursor`, or undefined for the first page */
  searchParams?: URLSearchParams;
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
  /** URLSearchParams carrying `cursor`, or undefined for the first page */
  searchParams?: URLSearchParams;
}

/**
 * Parameters for useEntityCollection hook.
 */
export type EntityCollectionParams = EntityCollectionDefault | EntityCollectionBySearch;

function isBySearch(params: EntityCollectionParams): params is EntityCollectionBySearch {
  return "searchValues" in params;
}

/**
 * React hook to fetch and manage an entity collection.
 *
 * Supports two modes:
 * - **Default**: Fetch the template's empty search, optionally paginated via `searchParams.get("cursor")`
 * - **By Search**: Transform search values to a Request URL, optionally paginated via `searchParams.get("cursor")`
 *
 * @param params - `{ profileEntity, searchParams? }` or `{ profileEntity, searchValues, searchParams? }`
 * @returns TanStack Query result with EntityItemCollection data
 *
 * @example
 * ```typescript
 * // Default collection (empty search), optionally on a given page
 * const { data: profile } = useProfileEntity({ name: "invoice" });
 * const { data: collection } = useEntityItemCollection({ profileEntity: profile!, searchParams });
 *
 * // With search filters
 * const searchValues = createValues(profile.searchTemplate.template);
 * const { data: filtered } = useEntityItemCollection({
 *   profileEntity: profile!,
 *   searchValues
 * });
 * ```
 */
/**
 * Resolve the collection request URL and query-enabled flag from the params,
 * without calling any hooks. Shared by both collection hooks so each can call
 * its TanStack hook exactly once, unconditionally (rules-of-hooks safe).
 *
 * `apiBaseUrl` (the absolute `profileUrl` from `useNavigatorData()`) is only a
 * resolution base for the `URL` constructor — `profileEntity.collectionUrl`
 * may be relative, which would otherwise make `new URL(...)` throw.
 */
function resolveCollectionRequest(
  params: EntityCollectionParams,
  apiBaseUrl: string,
): {
  url: string;
  enabled: boolean;
} {
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

  if (!request) return { url: "", enabled: false };
  const cursor = params.searchParams?.get("cursor");
  if (!cursor) return { url: request.url, enabled: true };

  const url = new URL(request.url, apiBaseUrl);
  url.searchParams.set("_cursor", cursor);
  return { url: url.href, enabled: true };
}

/**
 * Non-hook counterpart to `useEntityItemCollection`, for use in route
 * `loader`s (which run before any component mounts, so hooks aren't
 * available). Mirrors `ensureProfileEntity` (`use-profile-entity.ts`).
 */
export async function ensureEntityItemCollection(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  params: EntityCollectionParams,
  apiBaseUrl: string,
): Promise<void> {
  const { url, enabled } = resolveCollectionRequest(params, apiBaseUrl);
  if (!enabled) return;

  await queryClient.ensureQueryData(
    EntityItemCollection.fetchByUrlQuery(apiFetch, url, params.profileEntity),
  );
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
 * - **Default**: Start infinite scroll from the template's empty search
 * - **By Search**: Transform search values to initial URL (defaults to empty search)
 *
 * Fetches pages progressively using HAL next links. Each page is appended
 * to the previous pages, building up a continuous list.
 *
 * @param params - `{ profileEntity, searchParams? }` or `{ profileEntity, searchValues, searchParams? }`
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
