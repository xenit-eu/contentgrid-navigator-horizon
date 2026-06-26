import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import type ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useSetToOneRelation` hook.
 */
export type UseSetToOneRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, string>,
    "mutationFn"
  >;
};

/**
 * Mutation hook for setting (replacing) a to-one relation (PUT text/uri-list).
 *
 * Driven by the entity item's `set-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `set-<rel>` template is absent.
 *
 * The `relation` and `targetProfile` are bound at hook construction. The mutation
 * variable is the bare target URI (`string`).
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the source item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Invalidates the to-one relation read key
 *   (`toOneRelation.byUrl(targetProfile, relation.link.href)`) so the read hook
 *   refetches. Also invalidates the specific target item by URL
 *   (`entityItem.byUrlForName`). Does NOT invalidate the source collection or all
 *   source items.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (blind-relation-overwrite), the error surfaces
 * as `ProblemDetailError` to the caller — the hook does NOT auto-retry.
 *
 * @param relation - The bound to-one relation object (from `item.getToOneRelation(name)`)
 * @param targetProfile - The profile of the target entity type (for read-key scoping)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the re-fetched source `EntityItem` (or
 *   `undefined` if the re-fetch fails — write still succeeded in that case).
 */
export function useSetToOneRelation(
  relation: EntityItemToOneRelation,
  targetProfile: ProfileEntity,
  options?: UseSetToOneRelationOptions,
) {
  return useRelationMutationBase<EntityItemToOneRelation, string>({
    relation,
    targetProfile,
    buildRequest: (uri) => relation.setRelationRequest(uri),
    readKey: queryKeys.toOneRelation.byUrl(targetProfile, relation.link.href),
    invalidateTargets: async (queryClient, uri) => {
      // Derive target entity name for a scoped cache key.
      const targetName = relation.profileRelation.targetProfileLink?.name;
      if (targetName) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entityItem.byUrlForName(targetName, uri),
        });
      }
    },
    mutationOptions: options?.mutationOptions,
  });
}
