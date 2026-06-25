import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

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
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async ({ entityItem, relationName }: ClearRelationVariables) => {
      // Build the relation request via EntityItemRelation. Throws before any fetch if:
      //   - profile has no such relation (undefined)
      //   - template is absent (ABAC deny)
      const relation = entityItem.getRelation(relationName);
      if (!relation) {
        throw new Error(
          `Relation '${relationName}' not found in entity profile '${entityItem.profileEntity.name}'`,
        );
      }
      const baseReq = relation.clearRequest();

      // Attach If-Match from the item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, entityItem.etag);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, req);

      // Best-effort re-fetch of the parent item for fresh state + new ETag.
      // If the re-fetch throws, the committed write is still a success — resolve with
      // undefined so onSettled still fires.
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
      // Note: No target invalidation for clear — the previously-linked hrefs are not
      // available at this point. Previously-linked targets' inverse views may lag until
      // their staleTime expires; a future relation-read hook will own proactive invalidation.

      // Compose caller's onSettled LAST.
      await onSettled?.(item, error, variables, context, mutation);
    },
    ...restMutationOptions,
  });
}
