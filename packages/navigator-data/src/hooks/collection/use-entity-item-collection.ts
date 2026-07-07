import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { CURSOR_QUERY_PARAM, EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchRequestSpec } from "../../api/requests";
import type { QueryOptionsOverride } from "../../utils/query-options-override";
import { useNavigatorData } from "../context";

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
  /**
   * Bare pagination cursor token (from `EntityItemCollection.nextCursor` /
   * `prevCursor`) to merge onto this request. Use this — not a raw next/prev
   * href — when restoring pagination state from the `cursor` URL param.
   */
  cursor?: string;
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
  /** Bare pagination cursor token — see `EntityCollectionDefault.cursor`. */
  cursor?: string;
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
 * - **By URL**: Fetch a specific page using a full collection URL (from next/prev links or
 *   router params). Prefer the `cursor` option below for pagination — this mode is for
 *   following a link verbatim (e.g. a relation's collection link) where no reconstruction
 *   is needed or wanted.
 * - **By Search**: Transform search values to a Request URL, then fetch (defaults to empty
 *   search). Accepts an optional `cursor` (a bare token from `nextCursor`/`prevCursor`) merged
 *   onto the built URL — this is the pagination path for state restored from a URL param.
 *
 * @param params - Either `{ url, profileEntity }` or `{ profileEntity, searchValues?, cursor? }`
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
 * // Pagination — restore from a bare cursor token (e.g. the cursor URL param)
 * const { data: nextPage } = useEntityCollection({
 *   profileEntity: profile!,
 *   cursor: collection.nextCursor
 * });
 * ```
 */
/**
 * Resolve the collection request URL and query-enabled flag from the params,
 * without calling any hooks. Shared by both collection hooks so each can call
 * its TanStack hook exactly once, unconditionally (rules-of-hooks safe).
 */
export function resolveCollectionRequest(params: EntityCollectionParams): {
  url: string;
  enabled: boolean;
} {
  // URL-based fetch: follow the given URL verbatim (e.g. a relation's
  // collection link, or a next/prev link for infinite scroll) — always fired
  // straight to the ContentGrid backend.
  if (isByUrl(params)) {
    return { url: params.url, enabled: true };
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

  if (!request) {
    return { url: "", enabled: false };
  }

  // Merge a restored pagination cursor token onto the freshly-built request —
  // the token itself is never inspected, only relocated onto this trusted
  // base URL. See the exception documented in navigator-data/CLAUDE.md.
  let url = request.url;
  if (params.cursor) {
    const cursorUrl = new URL(url);
    cursorUrl.searchParams.set(CURSOR_QUERY_PARAM, params.cursor);
    url = cursorUrl.href;
  }
  return { url, enabled: true };
}

export function useEntityItemCollection(
  params: EntityCollectionParams,
  options?: UseEntityItemCollectionOptions,
) {
  const { apiFetch } = useNavigatorData();
  const { url, enabled } = resolveCollectionRequest(params);

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
  const { apiFetch } = useNavigatorData();
  const { url, enabled } = resolveCollectionRequest(params);

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
