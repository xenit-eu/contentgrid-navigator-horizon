import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { TypedFetch } from "../../api/client";
import type { SearchRequestSpec } from "../../api/requests";
import { resolveCursorHref } from "../../search/pagination-links";
import type { QueryOptionsOverride } from "../../utils/query-options-override";
import { useNavigatorData } from "../context";

export interface UseEntityItemCollectionOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
}

/**
 * Parameters for fetching a collection with the template's default empty search.
 * `searchParams` carries the route's `cursor` value (if present) as a standard
 * `URLSearchParams` — the caller builds it from the route's validated search
 * state. `cursor` is an opaque token (e.g. `0p4jtvf1`), never a URL; it's
 * resolved back to the literal href it was minted from via the cursor
 * registry (`src/search/pagination-links.ts`) — never decoded or rebuilt.
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
 * Never constructs a URL: the first-page URL always comes verbatim from
 * `profileEntity.searchEntityRequest(...)` (the template-driven request
 * builder); a cursor page's URL always comes verbatim from the cursor
 * registry — the exact `nextHref`/`prevHref` the server returned when the
 * token was minted. An unrecognised token (bookmark, share, reload — the
 * registry is session-scoped) falls back to the first-page URL rather than
 * guessing at one.
 */
function resolveCollectionRequest(
  params: EntityCollectionParams,
  queryClient: QueryClient,
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

  const cursorHref = resolveCursorHref(queryClient, params.profileEntity.name, cursor);
  return { url: cursorHref ?? request.url, enabled: true };
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
): Promise<void> {
  const { url, enabled } = resolveCollectionRequest(params, queryClient);
  if (!enabled) return;

  await queryClient.ensureQueryData(
    EntityItemCollection.fetchByUrlQuery(apiFetch, url, params.profileEntity),
  );
}

export function useEntityItemCollection(
  params: EntityCollectionParams,
  options?: UseEntityItemCollectionOptions,
) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { url, enabled } = resolveCollectionRequest(params, queryClient);

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
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { url, enabled } = resolveCollectionRequest(params, queryClient);

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
