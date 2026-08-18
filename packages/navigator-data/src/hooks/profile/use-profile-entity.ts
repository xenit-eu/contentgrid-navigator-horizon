import { type QueryClient, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Link } from "@contentgrid/hal";
import ProfileEntity, { profileRootQuery } from "../../accessors/entity-profile";
import { cgRels } from "../../api";
import type { TypedFetch } from "../../api/client";
import type { QueryOptionsOverride } from "../../utils/query-options-override";
import { useNavigatorData } from "../context";

interface UseProfileEntitiesOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<ProfileEntity, Error>>;
}

/**
 * Hook to fetch all entity profiles using useQueries for better granularity.
 *
 * First fetches the profile root to discover entity links, then uses useQueries
 * to fetch each individual profile in parallel. Each profile gets its own cache
 * entry, loading state, and can be refetched independently.
 *
 * @example
 * ```typescript
 * const profiles = useProfileEntities();
 * // profiles is an array of query results
 * profiles.forEach(result => {
 *   if (result.data) {
 *     console.log(result.data.name, result.isLoading, result.error);
 *   }
 * });
 *
 * // Get all successfully loaded profiles:
 * const loaded = profiles
 *   .filter(r => r.data)
 *   .map(r => r.data!);
 * ```
 */
export function useProfileEntities(options?: UseProfileEntitiesOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();

  // First, fetch the profile root to get all entity links
  const { data: rootProfile } = useQuery(profileRootQuery(apiFetch, profileUrl));

  // Then use useQueries to fetch each individual profile
  const entityLinks = rootProfile?.links.findLinks(cgRels.entity) ?? [];

  return useQueries({
    queries: entityLinks.map((link) =>
      ProfileEntity.profileByLinkQuery(apiFetch, link, options?.queryOptionsOverride),
    ),
    combine: (results) => results, // Return all query results with individual states
  });
}

/**
 * Convenience wrapper over `useProfileEntities()` for consumers that only
 * need the successfully-loaded profiles plus a single loading flag, instead
 * of the raw per-entity query-result array.
 */
export function useLoadedProfileEntities(options?: UseProfileEntitiesOptions): {
  readonly profiles: readonly ProfileEntity[];
  readonly isLoading: boolean;
} {
  const results = useProfileEntities(options);
  return {
    profiles: results.filter((r) => r.data).map((r) => r.data as ProfileEntity),
    isLoading: results.length > 0 && results.every((r) => r.isPending),
  };
}

/**
 * Filter criteria for finding a specific entity profile.
 * At least one property must be specified.
 */
export interface ProfileFilter {
  /** Entity name (singular form from the profile) */
  readonly name?: string;
  /** Full URL to the profile resource */
  readonly href?: string;
}

/** Shared by `useProfileEntity` and `ensureProfileEntity` — one matching rule, not two. */
function findEntityLink(
  rootProfile: { links: { findLinks: (rel: typeof cgRels.entity) => readonly Link[] } },
  filter: ProfileFilter,
): Link | undefined {
  return rootProfile.links.findLinks(cgRels.entity).find((link) => {
    if (filter.name && link.name === filter.name) return true;
    if (filter.href && link.href === filter.href) return true;
    return false;
  });
}

interface UseProfileEntityOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<ProfileEntity, Error>>;
}

/**
 * Hook to fetch a specific entity profile by filter criteria.
 *
 * Reuses the cached profile root to look up the entity link, then fetches
 * the profile using the same query pattern as useProfileEntities.
 * This ensures consistent cache keys across both hooks.
 *
 * @param filter - Criteria to find the entity (name or href)
 *
 * @example
 * ```typescript
 * // Find by name
 * const { data: profile } = useProfileEntity({ name: "invoice" });
 *
 * // Find by href
 * const { data: profile } = useProfileEntity({ href: "/profile/invoices" });
 *
 * if (profile) {
 *   console.log(profile.title, profile.attributes);
 * }
 * ```
 */
export function useProfileEntity(filter: ProfileFilter, options?: UseProfileEntityOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();
  const queryClient = useQueryClient();

  // Fetch profile root to get the entity link (likely already cached)
  const rootQuery = useQuery(profileRootQuery(apiFetch, profileUrl));
  const entityLink = rootQuery.data && findEntityLink(rootQuery.data, filter);

  // Four states: root still loading (wait), root failed (surface that error
  // rather than hanging forever), root loaded with no matching link
  // (definitively not found — resolve to null), or link found (fetch it).
  return useQuery({
    ...(entityLink
      ? ProfileEntity.profileByLinkQuery(apiFetch, entityLink, options?.queryOptionsOverride)
      : {
          queryKey: ["ProfileEntity", "not-found", filter.name ?? filter.href ?? null] as const,
          // Re-fetches (not just re-reads) the profile root via the query
          // client, so calling this query's own `refetch()` also retries a
          // previously-failed root fetch — not just its own stale closure.
          queryFn: async () => {
            await queryClient.fetchQuery(profileRootQuery(apiFetch, profileUrl));
            return null as unknown as ProfileEntity;
          },
          // The root fetch (above) already carries its own retry policy —
          // retrying this wrapper on top would just double the backoff delay.
          retry: false,
        }),
    enabled: !!entityLink || rootQuery.isSuccess || rootQuery.isError,
  });
}

/**
 * Non-hook counterpart to `useProfileEntity`, for use in route `loader`s
 * (which run before any component mounts, so hooks aren't available).
 * Ensures the profile root and the matching entity profile are both loaded
 * into the query cache, returning `null` when no entity matches the filter.
 */
export async function ensureProfileEntity(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  filter: ProfileFilter,
): Promise<ProfileEntity | null> {
  const rootProfile = await queryClient.ensureQueryData(profileRootQuery(apiFetch, profileUrl));
  const entityLink = findEntityLink(rootProfile, filter);

  if (!entityLink) return null;

  return queryClient.ensureQueryData(ProfileEntity.profileByLinkQuery(apiFetch, entityLink));
}
