import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { queryKeys } from "../query-keys";
import { useRelationMutationBase } from "./use-relation-mutation-base";

/**
 * Options for the `useAddRelation` hook.
 */
export type UseAddRelationOptions = {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, AddRelationVariables>,
    "mutationFn"
  >;
};

/**
 * Variables passed to the `useAddRelation` mutation function.
 */
export type AddRelationVariables = {
  /** The entity item whose to-many relation is being added to. */
  readonly entityItem: EntityItem;
  /** The name of the to-many relation to add to (e.g. "lineItems"). */
  readonly relationName: string;
  /** The hrefs of the target entity items (one or more). */
  readonly targetHrefs: readonly string[];
};

/**
 * Mutation hook for adding to a to-many relation (POST text/uri-list).
 *
 * Driven by the entity item's `add-<rel>` HAL-FORMS template.
 * Throws `RelationCardinalityError` (before any fetch) if the relation is to-one.
 * Throws an ABAC error (before any fetch) if the `add-<rel>` template is absent.
 *
 * Attaches `If-Match` from the item ETag to prevent concurrent update conflicts (RFC 9110).
 *
 * Cache behaviour on settled:
 * - `onSuccess`: `setQueryData` on the parent item's `entityItem.byUrl` key (fresh ETag).
 * - `onSettled`: Invalidates each specific target item by URL (`entityItem.byUrlForName`).
 *   Target entity name is derived from the relation's `targetProfileLink.name`; if not
 *   available, target invalidation is skipped.
 *   Does NOT invalidate the source collection or all source items.
 * - Caller's `onSuccess` / `onSettled` run last (after cache is consistent).
 *
 * On HTTP 412 (ETag mismatch) or 409, the error surfaces as `ProblemDetailError` to the
 * caller — the hook does NOT auto-retry.
 *
 * @returns TanStack mutation result; `data` is the re-fetched `EntityItem` (or undefined
 *   if the re-fetch fails — write still succeeded in that case).
 */
export function useAddRelation(options?: UseAddRelationOptions) {
  return useRelationMutationBase<AddRelationVariables>({
    buildRequest: (relation, { targetHrefs }) => relation.addRequest(targetHrefs),
    invalidateTargets: async (queryClient, { entityItem, relationName, targetHrefs }) => {
      // Derive target entity name from the relation profile.
      const relation = entityItem.getRelation(relationName);
      const targetName = relation?.profile.targetProfileLink?.name;

      // Invalidate each specific target item by URL — not the whole target collection.
      if (targetName) {
        await Promise.all(
          targetHrefs.map((href) =>
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
