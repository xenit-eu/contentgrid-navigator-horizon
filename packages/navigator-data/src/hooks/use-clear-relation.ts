import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import type ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useClearRelation` hook.
 */
export type UseClearRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, void>,
    "mutationFn"
  >;
};

/**
 * Mutation hook for clearing a relation (DELETE), valid for both to-one and to-many.
 *
 * Driven by the entity item's `clear-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `clear-<rel>` template is absent.
 *
 * The `relation` and `targetProfile` are bound at hook construction. The mutation
 * variable is `void` (no input needed — the relation to clear is already known).
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the source item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Invalidates the relation read key (to-one or to-many, chosen by
 *   `relation instanceof EntityItemToOneRelation`) so the read hook refetches.
 *   Does NOT invalidate target items — the previously-linked hrefs are not available
 *   at clear time.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (integrity/required-relation), the error surfaces
 * as `ProblemDetailError` to the caller — the hook does NOT auto-retry. For 409
 * `integrity/required-relation`, the caller must re-link or delete the referencing
 * entity before clearing.
 *
 * @param relation - The bound relation object (to-one or to-many)
 * @param targetProfile - The profile of the target entity type (for read-key scoping)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the re-fetched source `EntityItem` (or
 *   `undefined` if the re-fetch fails — write still succeeded in that case).
 */
export function useClearRelation(
  relation: EntityItemToOneRelation | EntityItemToManyRelation,
  targetProfile: ProfileEntity,
  options?: UseClearRelationOptions,
) {
  // Choose the read key namespace based on whether this is a to-one or to-many relation.
  const readKey =
    relation instanceof EntityItemToOneRelation
      ? queryKeys.toOneRelation.byUrl(targetProfile, relation.link.href)
      : queryKeys.toManyRelation.byUrl(targetProfile, relation.link.href);

  return useRelationMutationBase<EntityItemToOneRelation | EntityItemToManyRelation, void>({
    relation,
    targetProfile,
    buildRequest: () => relation.clearRelationRequest(),
    readKey,
    // No target invalidation for clear — the previously-linked hrefs are not available
    // at this point. Previously-linked targets' inverse views may lag until their
    // staleTime expires; a future relation-read hook will own proactive invalidation.
    mutationOptions: options?.mutationOptions,
  });
}
