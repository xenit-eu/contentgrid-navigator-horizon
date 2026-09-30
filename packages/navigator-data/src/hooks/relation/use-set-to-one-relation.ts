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
 * Currently sends no `If-Match` — the to-one relation's own ETag is not yet captured.
 * See FIXME(ACC-3186) in `use-relation-mutation-base.ts`.
 *
 * Cache behaviour on settled:
 * - `onSettled`: Invalidates the to-one relation read key
 *   (`toOneRelation.byUrl(targetProfile, relation.link.href)`) so the read hook
 *   refetches. Does NOT invalidate the source item or source collection — entity
 *   items do not change when a relation is set.
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
