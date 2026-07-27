import { useQueries, useQuery } from "@tanstack/react-query";
import ProfileEntity, { profileRootQuery } from "../../accessors/entity-profile";
import { cgRels } from "../../api";
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
 * Filter criteria for finding a specific entity profile.
 * At least one property must be specified.
 */
export interface ProfileFilter {
  /** Entity name (singular form from the profile) */
  readonly name?: string;
  /** Full URL to the profile resource */
  readonly href?: string;
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

  // Fetch profile root to get the entity link (likely already cached)
  const { data: rootProfile } = useQuery(profileRootQuery(apiFetch, profileUrl));

  // Find the link for this entity by filter criteria
  const entityLink = rootProfile?.links.findLinks(cgRels.entity).find((link) => {
    if (filter.name && link.name === filter.name) return true;
    if (filter.href && link.href === filter.href) return true;
    return false;
  });

  // Fetch the specific profile using the same query pattern as useProfileEntities.
  // Only fetch if we found the link in the profile root. When entityLink is undefined
  // (profile root not yet loaded or entity not found), provide a placeholder queryKey
  // so TanStack Query does not throw during key computation on initial renders.
  return useQuery({
    ...(entityLink
      ? ProfileEntity.profileByLinkQuery(apiFetch, entityLink, options?.queryOptionsOverride)
      : {
          queryKey: ["ProfileEntity", null, null] as const,
          queryFn: () => Promise.resolve(null as unknown as ProfileEntity),
        }),
    enabled: !!entityLink,
  });
}
