import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useAddToManyRelation` hook.
 */
export type UseAddToManyRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, string[]>,
    "mutationFn"
  >;
};

/**
 * Mutation hook for adding to a to-many relation (POST text/uri-list).
 *
 * Driven by the entity item's `add-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `add-<rel>` template is absent.
 *
 * The `relation` and `targetProfile` are bound at hook construction. The mutation
 * variable is a `string[]` of target URIs to add.
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the source item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Invalidates the to-many relation read key
 *   (`toManyRelation.byUrl(targetProfile, relation.link.href)`) so the read hook
 *   refetches. Also invalidates each specific target item by URL
 *   (`entityItem.byUrlForName`). Does NOT invalidate the source collection or all
 *   source items.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409, the error surfaces as `ProblemDetailError` to
 * the caller — the hook does NOT auto-retry.
 *
 * @param relation - The bound to-many relation object (from `item.getToManyRelation(name)`)
 * @param targetProfile - The profile of the target entity type (for read-key scoping)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the re-fetched source `EntityItem` (or
 *   `undefined` if the re-fetch fails — write still succeeded in that case).
 */
export function useAddToManyRelation(
  relation: EntityItemToManyRelation,
  targetProfile: ProfileEntity,
  options?: UseAddToManyRelationOptions,
) {
  return useRelationMutationBase<EntityItemToManyRelation, string[]>({
    relation,
    targetProfile,
    buildRequest: (uris) => relation.addRelationRequest(uris),
    readKey: queryKeys.toManyRelation.byUrl(targetProfile, relation.link.href),
    invalidateTargets: async (queryClient, uris) => {
      // Derive target entity name for scoped cache keys.
      const targetName = relation.profileRelation.targetProfileLink?.name;
      if (targetName) {
        await Promise.all(
          uris.map((href) =>
            queryClient.invalidateQueries({
              queryKey: queryKeys.entityItem.byUrlForName(targetName, href),
            }),
          ),
        );
      }
    },
    mutationOptions: options?.mutationOptions,
  });
}
