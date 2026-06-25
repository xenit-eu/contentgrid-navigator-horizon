import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useClearRelation` hook.
 */
export type UseClearRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, ClearRelationVariables>,
    "mutationFn"
  >;
};

/**
 * Variables passed to the `useClearRelation` mutation function.
 */
export type ClearRelationVariables = {
  /** The entity item whose relation is being cleared. */
  readonly entityItem: EntityItem;
  /** The name of the relation to clear (e.g. "supplier", "lineItems"). */
  readonly relationName: string;
};

/**
 * Mutation hook for clearing a relation (DELETE), valid for both to-one and to-many.
 *
 * Driven by the entity item's `clear-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `clear-<rel>` template is absent.
 *
 * Attaches `If-Match` from the item ETag to prevent concurrent update conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the parent item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Does NOT invalidate target items — the previously-linked hrefs are not
 *   available at clear time. Previously-linked targets' inverse views may lag until their
 *   staleTime expires. A future relation-read hook will own proactive target invalidation.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (integrity/required-relation), the error surfaces as
 * `ProblemDetailError` to the caller — the hook does NOT auto-retry. For 409
 * `integrity/required-relation`, the caller must re-link or delete the referencing entity
 * before clearing.
 *
 * @returns TanStack mutation result; `data` is the re-fetched `EntityItem` (or undefined
 *   if the re-fetch fails — write still succeeded in that case).
 */
export function useClearRelation(options?: UseClearRelationOptions) {
  return useRelationMutationBase<ClearRelationVariables>({
    buildRequest: (relation) => relation.clearRequest(),
    // No target invalidation for clear — the previously-linked hrefs are not available
    // at this point. Previously-linked targets' inverse views may lag until their
    // staleTime expires; a future relation-read hook will own proactive invalidation.
    mutationOptions: options?.mutationOptions,
  });
}
