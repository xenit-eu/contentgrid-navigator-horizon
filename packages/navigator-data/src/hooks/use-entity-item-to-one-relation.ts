import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { EntityItem } from "../accessors/entity-item";
import { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

export interface UseEntityItemToOneRelationOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItem | null, Error>>;
}

/**
 * Fetches the target entity item for a to-one relation.
 *
 * The query is disabled until the target entity's profile has been resolved from
 * the loaded profile list. While the target profile is unavailable, a stable
 * placeholder query key is used so TanStack Query does not throw.
 *
 * Returns `null` when the relation slot is empty (server responded with 404).
 *
 * @param relation - The to-one relation instance from `entityItem.getToOneRelation(name)`
 * @param options  - Optional TanStack Query overrides
 *
 * @example
 * ```typescript
 * const rel = item.getToOneRelation("supplier");
 * const { data: supplier } = useEntityItemToOneRelation(rel!);
 * if (supplier) {
 *   console.log(supplier.id);
 * }
 * ```
 */
export function useEntityItemToOneRelation(
  relation: EntityItemToOneRelation,
  options?: UseEntityItemToOneRelationOptions,
): UseQueryResult<EntityItem | null, Error> {
  const { apiFetch } = useNavigatorData();

  // Always call useProfileEntities — Rules of Hooks require it unconditionally.
  // Results are cached so there is no extra network cost when called repeatedly.
  const profileResults = useProfileEntities();

  const targetProfile = relation.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  return useQuery({
    // When targetProfile is undefined (not yet resolved), use a stable placeholder
    // queryKey + no-op queryFn, and disable the query via `enabled: false`.
    // This mirrors the pattern in use-profile-entity.ts for unresolved entity links.
    ...(targetProfile
      ? EntityItemToOneRelation.fetchQuery(apiFetch, relation.link.href, targetProfile)
      : {
          queryKey: ["ToOneRelation", null, null] as const,
          queryFn: () => Promise.resolve(null as unknown as EntityItem | null),
        }),
    enabled: !!targetProfile,
    ...options?.queryOptionsOverride,
  });
}
