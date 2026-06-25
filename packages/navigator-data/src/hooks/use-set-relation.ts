import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { queryKeys } from "../query-keys";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useSetRelation` hook.
 */
export type UseSetRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, SetRelationVariables>,
    "mutationFn"
  >;
};

/**
 * Variables passed to the `useSetRelation` mutation function.
 */
export type SetRelationVariables = {
  /** The entity item whose to-one relation is being set. */
  readonly entityItem: EntityItem;
  /** The name of the to-one relation to set (e.g. "supplier"). */
  readonly relationName: string;
  /** The href of the target entity item. */
  readonly targetHref: string;
};

/**
 * Mutation hook for setting (replacing) a to-one relation (PUT text/uri-list).
 *
 * Driven by the entity item's `set-<rel>` HAL-FORMS template.
 * Throws `RelationCardinalityError` (before any fetch) if the relation is to-many.
 * Throws an ABAC error (before any fetch) if the `set-<rel>` template is absent.
 *
 * Attaches `If-Match` from the item ETag to prevent concurrent update conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the parent item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Invalidates the specific target item by URL (`entityItem.byUrlForName`).
 *   Target entity name is derived from the relation's `targetProfileLink.name`; if not
 *   available, target invalidation is skipped.
 *   Does NOT invalidate the source collection or all source items (see ACTION 2 rationale).
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409 (blind-relation-overwrite), the error surfaces as
 * `ProblemDetailError` to the caller — the hook does NOT auto-retry.
 *
 * @returns TanStack mutation result; `data` is the re-fetched `EntityItem` (or the
 *   pre-mutation item if the re-fetch fails — write still succeeded in that case).
 */
export function useSetRelation(options?: UseSetRelationOptions) {
  return useRelationMutationBase<SetRelationVariables>({
    buildRequest: (relation, { targetHref }) => relation.setRequest(targetHref),
    invalidateTargets: async (queryClient, { entityItem, relationName, targetHref }) => {
      // Derive target entity name from the relation profile to build a scoped key.
      const relation = entityItem.getRelation(relationName);
      const targetName = relation?.profile.targetProfileLink?.name;

      // Invalidate the specific target item URL only — not the whole target collection.
      // This avoids busting unrelated cached pages.
      if (targetName) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entityItem.byUrlForName(targetName, targetHref),
        });
      }
    },
    mutationOptions: options?.mutationOptions,
  });
}
