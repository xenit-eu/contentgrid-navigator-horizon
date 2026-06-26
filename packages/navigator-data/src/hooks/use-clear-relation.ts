import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useClearRelation` hook.
 */
export type UseClearRelationOptions = {
  readonly mutationOptions?: Omit<UseMutationOptions<void, Error, void>, "mutationFn">;
};

/**
 * Mutation hook for clearing a relation (DELETE), valid for both to-one and to-many.
 *
 * Driven by the entity item's `clear-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `clear-<rel>` template is absent.
 *
 * The `relation` is bound at hook construction. The mutation variable is `void`
 * (no input needed — the relation to clear is already known). The target profile is
 * resolved internally via `useProfileEntities()` — no `targetProfile` parameter is
 * required. Cardinality (to-one vs. to-many) is determined at runtime via
 * `relation instanceof EntityItemToOneRelation` inside the base.
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSettled`: Invalidates the relation read key (to-one or to-many, chosen by
 *   cardinality) so the read hook refetches. Does NOT invalidate target items —
 *   the previously-linked hrefs are not available at clear time.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (integrity/required-relation), the error surfaces
 * as `ProblemDetailError` to the caller — the hook does NOT auto-retry. For 409
 * `integrity/required-relation`, the caller must re-link or delete the referencing
 * entity before clearing.
 *
 * @param relation - The bound relation object (to-one or to-many)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is `void` (204 No Content).
 */
export function useClearRelation(
  relation: EntityItemToOneRelation | EntityItemToManyRelation,
  options?: UseClearRelationOptions,
) {
  return useRelationMutationBase<EntityItemToOneRelation | EntityItemToManyRelation, void>({
    relation,
    buildRequest: () => relation.clearRelationRequest(),
    mutationOptions: options?.mutationOptions,
  });
}
