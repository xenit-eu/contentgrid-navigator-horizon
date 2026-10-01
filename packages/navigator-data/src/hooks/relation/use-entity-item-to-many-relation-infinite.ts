import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { fetchHalSlice } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import { useNavigatorData } from "../context";
import { useProfileEntities } from "../profile/use-profile-entity";

export interface UseEntityItemToManyRelationInfiniteOptions {
  /** Set `false` to suspend the query (default `true`). */
  readonly enabled?: boolean;
}

/**
 * "Load more" access to **all** targets of a to-many relation, page by page.
 *
 * Starts at `relation.link.href` and follows each page's HAL `next` link (`nextHref`) — no page URL
 * or cursor is ever built. Cached under `queryKeys.toManyRelation.infiniteByUrl`, a child of
 * `toManyRelation.forRelationName`, so `useUnlinkRelation` / `useClearRelation` /
 * `useDeleteEntityItem` invalidation also refreshes the list.
 *
 * Disabled until both `relation` and its target profile are resolved.
 *
 * @param relation - The to-many relation; `undefined` disables the query (Rules of Hooks)
 * @param options  - Optional `enabled` switch
 */
export function useEntityItemToManyRelationInfinite(
  relation: EntityItemToManyRelation | undefined,
  options?: UseEntityItemToManyRelationInfiniteOptions,
): UseInfiniteQueryResult<InfiniteData<EntityItemCollection, string | undefined>, Error> {
  const { apiFetch } = useNavigatorData();

  // Always call unconditionally — Rules of Hooks. Profiles are cached.
  const profileResults = useProfileEntities();
  const targetProfile = relation?.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  const initialUrl = relation?.link.href;

  return useInfiniteQuery({
    queryKey:
      relation && initialUrl
        ? queryKeys.toManyRelation.infiniteByUrl(relation.name, initialUrl)
        : (["ToManyRelation", "__placeholder__", "infinite"] as const),
    // Same fetch as `EntityItemCollection.infiniteQuery`, keyed under the relation namespace.
    queryFn: async ({ pageParam }) => {
      const url = pageParam ?? initialUrl!;
      const slice = await fetchHalSlice<EntityItemShape>(apiFetch, new Request(url));
      return new EntityItemCollection(slice, targetProfile!);
    },
    initialPageParam: undefined as string | undefined,
    // Only ever the server-provided `next` link — never a constructed URL.
    getNextPageParam: (lastPage: EntityItemCollection) => lastPage.nextHref ?? undefined,
    enabled: (options?.enabled ?? true) && !!initialUrl && !!targetProfile,
  });
}
