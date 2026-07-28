import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useAddToManyRelation` hook.
 */
export type UseAddToManyRelationOptions = {
  readonly mutationOptions?: Omit<UseMutationOptions<void, Error, string[]>, "mutationFn">;
};

/**
 * Mutation hook for adding to a to-many relation (POST text/uri-list).
 *
 * Driven by the entity item's `add-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `add-<rel>` template is absent.
 *
 * The `relation` is bound at hook construction. The mutation variable is a `string[]`
 * of target URIs to add. The target profile is resolved internally via
 * `useProfileEntities()` — no `targetProfile` parameter is required.
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSettled`: Invalidates all cached pages of the to-many relation read
 *   (`toManyRelation.forRelationName(relation.name)`) — a newly-added item can land
 *   on any page, so a page-scoped invalidation could miss whichever page is
 *   currently being viewed. Also invalidates the source item's `entityItem` cache
 *   entry, since the add operation is gated on the source item's ETag.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409, the error surfaces as `ProblemDetailError` to
 * the caller — the hook does NOT auto-retry.
 *
 * @param relation - The bound to-many relation object (from `item.getToManyRelation(name)`)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is `void` (204 No Content).
 */
export function useAddToManyRelation(
  relation: EntityItemToManyRelation,
  options?: UseAddToManyRelationOptions,
) {
  return useRelationMutationBase<EntityItemToManyRelation, string[]>({
    relation,
    buildRequest: (uris) => relation.addRelationRequest(uris),
    mutationOptions: options?.mutationOptions,
  });
}
