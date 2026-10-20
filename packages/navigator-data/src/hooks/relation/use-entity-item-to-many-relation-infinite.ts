import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
import type { EntityItemCollection } from "../../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useProfileEntities } from "../profile/use-profile-entity";

export interface UseEntityItemToManyRelationInfiniteOptions {
  /**
   * Set to `false` to keep the query from fetching, e.g. while a different view of the same
   * relation is shown. Combined with the hook's own prerequisites. Defaults to `true`.
   */
  readonly enabled?: boolean;
}

/**
 * Stand-in options while the target profile is still loading — never fetched (the hook keeps
 * the query disabled), but shaped like the real options so `useInfiniteQuery` is called once.
 */
function placeholderInfiniteQuery(relationUrl: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.toManyRelation.infiniteByUrl("__placeholder__", relationUrl),
    queryFn: (): Promise<EntityItemCollection> =>
      Promise.reject(new Error("Target profile is not resolved yet")),
    getNextPageParam: (lastPage: EntityItemCollection) => lastPage.nextHref ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * "Load more" view of a to-many relation: starts at the relation's first page
 * (`relation.link.href`) and appends each further page by following the HAL `next` link of the
 * last loaded one (`fetchNextPage` / `hasNextPage`). Keyed under the relation's
 * `toManyRelation` namespace, so link/unlink/delete/clear mutations on the relation refresh it.
 *
 * Disabled until both `relation` and its target profile (from `useProfileEntities()`) resolve.
 *
 * @param relation - The to-many relation from `entityItem.getToManyRelation(name)`; `undefined`
 *                   disables the query (Rules of Hooks)
 * @param options  - Optional `enabled` flag
 */
export function useEntityItemToManyRelationInfinite(
  relation: EntityItemToManyRelation | undefined,
  options?: UseEntityItemToManyRelationInfiniteOptions,
) {
  const { apiFetch } = useNavigatorData();

  // Always call unconditionally — Rules of Hooks.
  const profileResults = useProfileEntities();
  const targetProfile = relation?.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  const queryOptions =
    relation && targetProfile
      ? EntityItemToManyRelation.infiniteQuery(
          apiFetch,
          relation.link.href,
          targetProfile,
          relation.name,
        )
      : placeholderInfiniteQuery(relation?.link.href ?? "");

  return useInfiniteQuery({
    ...queryOptions,
    enabled: options?.enabled !== false && !!relation && !!targetProfile,
  });
}
