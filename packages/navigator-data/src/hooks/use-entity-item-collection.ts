import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import type ProfileEntity from "../accessors/entity-profile";
import { useNavigatorData } from "./context";

/**
 * React hook to fetch and manage an entity collection.
 *
 * Fetches the default entity collection (no search/filter parameters) using the
 * ProfileEntity's search template and returns an EntityItemCollection with typed
 * access to items, pagination metadata, and navigation links.
 *
 * Uses the static EntityItemCollection.searchQuery() factory with empty search values
 * for consistent caching behavior.
 *
 * @param entityName - Name of the entity (singular form from profile)
 * @returns TanStack Query result with EntityItemCollection data
 *
 * @example
 * ```typescript
 * const { data: collection, isLoading } = useEntityItemCollection("invoice");
 *
 * if (collection) {
 *   collection.items.forEach(item => {
 *     console.log(item.userDefinedAttributes);
 *   });
 *
 *   if (collection.hasNext) {
 *     // Fetch next page using collection.nextHref
 *   }
 * }
 * ```
 */
export function useEntityItemCollection(profileEntity: ProfileEntity) {
  const { apiFetch } = useNavigatorData();
  // Create empty search values (default collection, no filters)
  // Only possible when searchTemplate exists
  const searchTemplate = profileEntity?.searchTemplate;
  const searchValues = searchTemplate ? createValues(searchTemplate.template) : null;

  return useQuery({
    ...EntityItemCollection.searchQuery(
      apiFetch,
      profileEntity!, // TypeScript: guaranteed to exist when enabled=true
      searchValues!, // TypeScript: guaranteed to exist when enabled=true
    ),
    enabled: !!searchValues,
  });
}

/**
 * React hook to fetch a specific page of an entity collection by URL.
 *
 * Use this for cursor-based pagination when you have a next/prev URL from
 * a previous collection response. Typically used with TanStack Router search params.
 *
 * The URL serves as the cache key, ensuring each page is cached independently
 * and can be navigated back to without refetching.
 *
 * @param url - Full collection URL (from nextHref/prevHref or search params)
 * @param profileEntity - Entity profile for schema metadata
 * @returns TanStack Query result with EntityItemCollection data
 *
 * @example
 * ```typescript
 * // In a route component with cursor from search params
 * function EntityListPage() {
 *   const { entityName } = Route.useParams();
 *   const { cursor } = Route.useSearch();
 *   const { data: profile } = useProfileEntity({ name: entityName });
 *
 *   // Fetch by cursor URL if present, otherwise first page
 *   const { data: collection } = cursor && profile
 *     ? useEntityCollectionPage(cursor, profile)
 *     : useEntityItemCollection(profile);
 *
 *   return (
 *     <>
 *       {collection?.items.map(item => <ItemCard key={item.id} item={item} />)}
 *
 *       {collection?.hasNext && (
 *         <Link search={{ cursor: collection.nextHref }}>Next</Link>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useEntityCollectionPage(url: string, profileEntity: ProfileEntity) {
  const { apiFetch } = useNavigatorData();

  return useQuery({
    ...EntityItemCollection.fetchByUrlQuery(apiFetch, url, profileEntity),
  });
}

/**
 * React hook for infinite scroll / "load more" pattern.
 *
 * Fetches pages progressively using HAL next links. Each page is appended
 * to the previous pages, building up a continuous list.
 *
 * Use this for infinite scroll UIs or "Load More" buttons where you want
 * to accumulate items across multiple pages.
 *
 * @param profileEntity - Entity profile for schema metadata
 * @returns TanStack Infinite Query result with pages array
 *
 * @example
 * ```typescript
 * function InfiniteEntityList() {
 *   const { data: profile } = useProfileEntity({ name: "invoice" });
 *   const {
 *     data,
 *     fetchNextPage,
 *     hasNextPage,
 *     isFetchingNextPage,
 *   } = useEntityInfiniteScroll(profile!);
 *
 *   return (
 *     <>
 *       {data?.pages.map((page, i) => (
 *         <React.Fragment key={i}>
 *           {page.items.map(item => (
 *             <ItemCard key={item.id} item={item} />
 *           ))}
 *         </React.Fragment>
 *       ))}
 *
 *       {hasNextPage && (
 *         <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
 *           {isFetchingNextPage ? 'Loading...' : 'Load More'}
 *         </button>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useEntityInfiniteScroll(profileEntity: ProfileEntity) {
  const { apiFetch } = useNavigatorData();

  // Create empty search values (default collection, no filters)
  const searchTemplate = profileEntity?.searchTemplate;
  const searchValues = searchTemplate ? createValues(searchTemplate.template) : null;

  return useInfiniteQuery({
    ...EntityItemCollection.infiniteSearchQuery(
      apiFetch,
      profileEntity!, // TypeScript: guaranteed to exist when enabled=true
      searchValues!, // TypeScript: guaranteed to exist when enabled=true
    ),
    enabled: !!searchValues,
  });
}
