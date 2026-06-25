import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

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
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async ({ entityItem, relationName, targetHrefs }: AddRelationVariables) => {
      // Build the relation request via EntityItemRelation. Throws before any fetch if:
      //   - profile has no such relation (undefined)
      //   - relation is to-one (RelationCardinalityError)
      //   - template is absent (ABAC deny)
      const relation = entityItem.getRelation(relationName);
      if (!relation) {
        throw new Error(
          `Relation '${relationName}' not found in entity profile '${entityItem.profileEntity.name}'`,
        );
      }
      const baseReq = relation.addRequest(targetHrefs);

      // Attach If-Match from the item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, entityItem.etag);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, req);

      // Best-effort re-fetch of the parent item for fresh state + new ETag.
      // If the re-fetch throws, the committed write is still a success — resolve with
      // undefined so onSettled invalidation still fires.
      try {
        const { object, etag } = await fetchHal<EntityItemShape>(
          apiFetch,
          new Request(entityItem.selfLink.href),
        );
        return new EntityItem(object, entityItem.profileEntity, etag);
      } catch {
        return undefined;
      }
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      // Populate item cache with fresh data + ETag (only when re-fetch succeeded).
      if (item) {
        queryClient.setQueryData(
          queryKeys.entityItem.byUrl(variables.entityItem.profileEntity, item.selfLink.href),
          item,
        );
      }

      // Compose caller's onSuccess LAST — after cache is consistent.
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    onSettled: async (item, error, variables, context, mutation) => {
      // Invalidations run on BOTH success and error so stale caches are always busted.

      // Derive target entity name from the relation profile.
      const relation = variables.entityItem.getRelation(variables.relationName);
      const targetName = relation?.profile.targetProfileLink?.name;

      // Invalidate each specific target item by URL — not the whole target collection.
      if (targetName) {
        await Promise.all(
          variables.targetHrefs.map((href) =>
            queryClient.invalidateQueries({
              queryKey: queryKeys.entityItem.byUrlForName(targetName, href),
            }),
          ),
        );
      }

      // Compose caller's onSettled LAST.
      await onSettled?.(item, error, variables, context, mutation);
    },
    ...restMutationOptions,
  });
}
