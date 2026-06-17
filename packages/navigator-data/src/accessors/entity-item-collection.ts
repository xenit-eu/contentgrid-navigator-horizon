import { infiniteQueryOptions, keepPreviousData, queryOptions } from "@tanstack/react-query";
import { HalSlice } from "@contentgrid/hal";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import type { TypedFetch } from "../api/client";
import { fetchHalSlice } from "../api/hal-client";
import type { SearchRequestSpec } from "../api/requests";
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
   * Query options factory for entity collection search.
   *
   * Creates a TanStack Query configuration for fetching and caching search results.
   * Use this for prefetching, advanced query configuration, or in TanStack Router loaders.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param profileEntity - Entity profile with search template
   * @param searchValues - Search parameters (filters, sort, pagination)
   * @param override - Optional query options to override defaults
   */
  public static searchQuery(
    apiFetch: TypedFetch,
    profileEntity: ProfileEntity,
    searchValues: HalFormValues<SearchRequestSpec>,
    override: QueryOptionsOverride<EntityItemCollection, Error> = {},
  ) {
    const request = profileEntity.searchEntityRequest(searchValues);
    return queryOptions({
      queryKey: [ENTITY_SEARCH_QUERY_KEY, profileEntity.name, request.url] as const,
      queryFn: async () => {
        const slice = await fetchHalSlice<EntityItemShape>(apiFetch, request);
        return new EntityItemCollection(slice, profileEntity);
      },
      staleTime: ENTITY_SEARCH_STALE_TIME,
      placeholderData: keepPreviousData,
      gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache longer than stale time
      retry: 3,
      ...override,
    });
  }

  /**
   * Query options factory for fetching a collection page by URL.
   *
   * Use this for cursor-based pagination when you have a next/prev link URL
   * from a previous collection response. The URL itself serves as the cache key.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param url - Full URL to the collection page (from nextHref/prevHref)
   * @param profileEntity - Entity profile for schema metadata
   * @param override - Optional query options to override defaults
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
   * Infinite query options factory for entity collection search.
   *
   * Creates a TanStack Infinite Query configuration for infinite scroll / "load more" patterns.
   * Each page is fetched using the HAL next link from the previous page.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param profileEntity - Entity profile with search template
   * @param initialSearchValues - Search parameters for the first page
   * @param override - Optional query options to override defaults
   *
   * @example
   * ```typescript
   * // In a hook
   * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
   *   EntityItemCollection.infiniteSearchQuery(apiFetch, profile, searchValues)
   * );
   *
   * // Access all pages
   * data?.pages.forEach(collection => {
   *   collection.items.forEach(item => console.log(item));
   * });
   *
   * // Load more
   * if (hasNextPage) {
   *   fetchNextPage();
   * }
   * ```
   */
  public static infiniteSearchQuery(
    apiFetch: TypedFetch,
    profileEntity: ProfileEntity,
    initialSearchValues: HalFormValues<SearchRequestSpec>,
    override: Record<string, unknown> = {},
  ) {
    const firstPageRequest = profileEntity.searchEntityRequest(initialSearchValues);

    return infiniteQueryOptions({
      queryKey: [
        ENTITY_SEARCH_QUERY_KEY,
        "infinite",
        profileEntity.name,
        firstPageRequest.url,
      ] as const,
      queryFn: async ({ pageParam }) => {
        let slice: HalSlice<EntityItemShape>;

        if (pageParam) {
          // Fetch subsequent pages using the cursor URL
          slice = await fetchHalSlice<EntityItemShape>(apiFetch, new Request(pageParam as string));
        } else {
          // First page - use the initial search values
          slice = await fetchHalSlice<EntityItemShape>(apiFetch, firstPageRequest);
        }

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
