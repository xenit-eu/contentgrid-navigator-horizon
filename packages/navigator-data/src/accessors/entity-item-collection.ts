import { infiniteQueryOptions, keepPreviousData, queryOptions } from "@tanstack/react-query";
import { HalSlice } from "@contentgrid/hal";
import type { TypedFetch } from "../api/client";
import { fetchHalSlice } from "../api/hal-client";
import type { EntityItemShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { EntityItem } from "./entity-item";
import type ProfileEntity from "./entity-profile";

// Query configuration constants
const ENTITY_SEARCH_QUERY_KEY = "EntitySearch";
const ENTITY_SEARCH_STALE_TIME = 30 * 1000; // 30 seconds - search results change frequently

/**
 * Total item count metadata from a collection response.
 */
export interface CollectionTotalCount {
  /** The total number of items across all pages */
  count: number;
  /** Whether the count is an estimate (true) or exact (false) */
  isEstimated: boolean;
}

/**
 * Represents a paginated collection of entity items (entity-collection resource).
 *
 * Wraps a HAL collection response and provides typed access to individual EntityItem instances,
 * pagination metadata, and navigation links. Supports cursor-based pagination following HAL
 * next/prev links.
 *
 * @example
 * ```typescript
 * const collection = new EntityItemCollection(halSlice, profileEntity);
 *
 * // Access items as typed EntityItem instances
 * collection.items.forEach(item => {
 *   console.log(item.attributes);
 * });
 *
 * // Check pagination state
 * if (collection.hasNext) {
 *   const nextUrl = collection.nextHref;
 * }
 *
 * // Get total count with exact/estimate flag
 * const total = collection.totalItems;
 * if (total) {
 *   console.log(`${total.count} items${total.isEstimated ? ' (estimated)' : ''}`);
 * }
 * ```
 */
export class EntityItemCollection {
  // ========================================
  // Static Query Options Factories
  // ========================================

  /**
   * Query options factory for fetching a collection by URL.
   *
   * Use this for any collection fetch - first page from search, paginated pages,
   * or direct collection URLs. The URL itself serves as the cache key.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param url - Full URL to the collection (from search Request or next/prev links)
   * @param profileEntity - Entity profile for schema metadata
   * @param override - Optional query options to override defaults
   *
   * @example
   * ```typescript
   * // From search form
   * const request = profileEntity.searchEntityRequest(searchValues);
   * const query = EntityItemCollection.fetchByUrlQuery(apiFetch, request.url, profile);
   *
   * // From pagination
   * const query = EntityItemCollection.fetchByUrlQuery(apiFetch, collection.nextHref!, profile);
   * ```
   */
  public static fetchByUrlQuery(
    apiFetch: TypedFetch,
    url: string,
    profileEntity: ProfileEntity,
    override: QueryOptionsOverride<EntityItemCollection, Error> = {},
  ) {
    return queryOptions({
      queryKey: [ENTITY_SEARCH_QUERY_KEY, profileEntity.name, url] as const,
      queryFn: async () => {
        const slice = await fetchHalSlice<EntityItemShape>(apiFetch, new Request(url));
        return new EntityItemCollection(slice, profileEntity);
      },
      staleTime: ENTITY_SEARCH_STALE_TIME,
      placeholderData: keepPreviousData,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      ...override,
    });
  }

  /**
   * Infinite query options factory for progressive collection loading.
   *
   * Use this for infinite scroll / "load more" patterns. Each page is fetched
   * using the HAL next link from the previous page.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param initialUrl - URL for the first page (from search Request)
   * @param profileEntity - Entity profile for schema metadata
   * @param override - Optional query options to override defaults
   *
   * @example
   * ```typescript
   * const request = profileEntity.searchEntityRequest(searchValues);
   * const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
   *   EntityItemCollection.infiniteQuery(apiFetch, request.url, profile)
   * );
   * ```
   */
  public static infiniteQuery(
    apiFetch: TypedFetch,
    initialUrl: string,
    profileEntity: ProfileEntity,
    override: Record<string, unknown> = {},
  ) {
    return infiniteQueryOptions({
      queryKey: [ENTITY_SEARCH_QUERY_KEY, "infinite", profileEntity.name, initialUrl] as const,
      queryFn: async ({ pageParam }) => {
        const url = (pageParam as string | undefined) ?? initialUrl;
        const slice = await fetchHalSlice<EntityItemShape>(apiFetch, new Request(url));
        return new EntityItemCollection(slice, profileEntity);
      },
      getNextPageParam: (lastPage) => lastPage.nextHref ?? undefined,
      getPreviousPageParam: (firstPage) => firstPage.prevHref ?? undefined,

      initialPageParam: undefined as string | undefined,
      ...override,
    });
  }

  // ========================================
  // Constructor & Instance Properties
  // ========================================

  /**
   * @param halSlice - The HAL collection resource from the API
   * @param profileEntity - The entity profile providing schema metadata for all items
   */
  public constructor(
    public readonly halSlice: HalSlice<EntityItemShape>,
    public readonly profileEntity: ProfileEntity,
  ) {}

  /**
   * Array of entity items in this collection page.
   *
   * Each item is wrapped as an EntityItem with typed attribute access.
   * Items are returned in the order specified by the API (respecting sort parameters).
   *
   * @returns Typed EntityItem instances from the current page
   */
  public get items(): readonly EntityItem[] {
    return this.halSlice.items.map((halItem) => new EntityItem(halItem, this.profileEntity));
  }

  /**
   * Total number of items in the collection across all pages.
   *
   * Returns an object containing the count and whether it's estimated or exact.
   * Returns `undefined` if no total count is available (uncommon).
   *
   * From the HAL `page` object: `total_items_exact` or `total_items_estimate`.
   *
   * @returns Total count metadata or undefined if not available
   *
   * @example
   * ```typescript
   * const total = collection.totalItems;
   * if (total) {
   *   console.log(`${total.count} items${total.isEstimated ? ' (estimated)' : ''}`);
   * }
   * ```
   */
  public get totalItems(): CollectionTotalCount | undefined {
    const pageData = (this.halSlice.data as Record<string, unknown>).page as
      | { total_items_exact?: number; total_items_estimate?: number }
      | undefined;

    if (pageData?.total_items_exact !== undefined) {
      return {
        count: pageData.total_items_exact,
        isEstimated: false,
      };
    }

    if (pageData?.total_items_estimate !== undefined) {
      return {
        count: pageData.total_items_estimate,
        isEstimated: true,
      };
    }

    return undefined;
  }

  /**
   * Number of items in the current page.
   *
   * This is the actual count of items in `this.items`, which may be less than
   * the requested page size on the last page of results.
   *
   * @returns Count of items in the current page
   */
  public get pageSize(): number {
    return this.halSlice.items.length;
  }

  /**
   * Whether there is a next page of results.
   *
   * When `true`, use `nextHref` to fetch the next page. Follow HAL links
   * directly — never construct cursor URLs manually.
   *
   * @returns True if a next page exists
   */
  public get hasNext(): boolean {
    return this.halSlice.next !== null;
  }

  /**
   * Whether there is a previous page of results.
   *
   * When `true`, use `prevHref` to fetch the previous page.
   *
   * @returns True if a previous page exists
   */
  public get hasPrevious(): boolean {
    return this.halSlice.previous !== null;
  }

  /**
   * URL for the next page of results.
   *
   * Contains an opaque cursor — never parse or modify it. Pass directly to the
   * fetch function to retrieve the next page.
   *
   * @returns Next page URL or undefined if no next page
   */
  public get nextHref(): string | undefined {
    return this.halSlice.next?.href;
  }

  /**
   * URL for the previous page of results.
   *
   * Contains an opaque cursor — never parse or modify it. Pass directly to the
   * fetch function to retrieve the previous page.
   *
   * @returns Previous page URL or undefined if no previous page
   */
  public get prevHref(): string | undefined {
    return this.halSlice.previous?.href;
  }

  /**
   * URL for the first page of results.
   *
   * Useful for resetting pagination to the beginning. May be absent on some pages.
   *
   * @returns First page URL or undefined if not available
   */
  public get firstHref(): string | undefined {
    return this.halSlice.first?.href;
  }

  /**
   * Whether this collection is empty (no items on any page).
   *
   * Shorthand for checking if both `pageSize === 0` and `totalItems.count === 0`.
   *
   * @returns True if the collection has no items
   */
  public get isEmpty(): boolean {
    return this.pageSize === 0 && (this.totalItems?.count === 0 || this.totalItems === undefined);
  }
}
