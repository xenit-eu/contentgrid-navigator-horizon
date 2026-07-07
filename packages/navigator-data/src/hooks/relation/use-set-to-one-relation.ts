import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useSetToOneRelation` hook.
 */
export type UseSetToOneRelationOptions = {
  readonly mutationOptions?: Omit<UseMutationOptions<void, Error, string>, "mutationFn">;
};

/**
 * Mutation hook for setting (replacing) a to-one relation (PUT text/uri-list).
 *
 * Driven by the entity item's `set-<rel>` HAL-FORMS template.
 * Throws an ABAC error (before any fetch) if the `set-<rel>` template is absent.
 *
 * The `relation` is bound at hook construction. The mutation variable is the bare
 * target URI (`string`). The target profile is resolved internally via
 * `useProfileEntities()` — no `targetProfile` parameter is required.
 *
 * Attaches `If-Match` from `relation.source.etag` to prevent concurrent update
 * conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSettled`: Invalidates the to-one relation read key
 *   (`toOneRelation.byUrl(relation.name, relation.link.href)`) so the read hook
 *   refetches. ALSO invalidates the source item's `entityItem.byUrl` entry —
 *   the mutation is gated on the source item's ETag, which the server may bump,
 *   so the cached ETag is refreshed to avoid a spurious 412 on the next mutation.
 *   Does NOT invalidate the source collection or the target item.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (blind-relation-overwrite), the error surfaces
 * as `ProblemDetailError` to the caller — the hook does NOT auto-retry.
 *
 * @param relation - The bound to-one relation object (from `item.getToOneRelation(name)`)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is `void` (204 No Content).
 */
export function useSetToOneRelation(
  relation: EntityItemToOneRelation,
  options?: UseSetToOneRelationOptions,
) {
  return useRelationMutationBase<EntityItemToOneRelation, string>({
    relation,
    buildRequest: (uri) => relation.setRelationRequest(uri),
    mutationOptions: options?.mutationOptions,
  });
}
