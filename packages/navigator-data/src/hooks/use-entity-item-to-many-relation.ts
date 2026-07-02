import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { EntityItemCollection } from "../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

export interface UseEntityItemToManyRelationOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
  /**
   * Fetch a specific page URL instead of the relation's first-page URL.
   * Use `collection.nextHref` / `collection.prevHref` from a previous result.
   * Defaults to `relation.link.href` when omitted.
   */
  readonly pageUrl?: string;
}

/**
 * Fetches the target entity collection for a to-many relation.
 *
 * The query is disabled until the target entity's profile has been resolved from
 * the loaded profile list. While the target profile is unavailable, a stable
 * placeholder query key is used so TanStack Query does not throw.
 *
 * An empty collection is returned when no items are linked (server returns an empty HAL slice).
 *
 * @param relation - The to-many relation instance from `entityItem.getToManyRelation(name)`
 * @param options  - Optional TanStack Query overrides; pass `pageUrl` to fetch a specific page
 *
 * @example
 * ```typescript
 * const rel = item.getToManyRelation("lineItems");
 * const { data: collection } = useEntityItemToManyRelation(rel!);
 * console.log(collection?.items.length);
 * ```
 */
export function useEntityItemToManyRelation(
  relation: EntityItemToManyRelation,
  options?: UseEntityItemToManyRelationOptions,
): UseQueryResult<EntityItemCollection, Error> {
  const { apiFetch } = useNavigatorData();

  // Always call useProfileEntities — Rules of Hooks require it unconditionally.
  // Results are cached so there is no extra network cost when called repeatedly.
  const profileResults = useProfileEntities();

  const targetProfile = relation.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  const url = options?.pageUrl ?? relation.link.href;

  return useQuery({
    // When targetProfile is undefined (not yet resolved), use a stable placeholder
    // queryKey + no-op queryFn, and disable the query via `enabled: false`.
    // This mirrors the pattern in use-profile-entity.ts for unresolved entity links.
    ...(targetProfile
      ? EntityItemToManyRelation.fetchQuery(apiFetch, url, targetProfile, relation.name)
      : {
          queryKey: ["ToManyRelation", relation.name, null] as const,
          queryFn: () => Promise.resolve(null as unknown as EntityItemCollection),
        }),
    enabled: !!targetProfile,
    ...options?.queryOptionsOverride,
  });
}
