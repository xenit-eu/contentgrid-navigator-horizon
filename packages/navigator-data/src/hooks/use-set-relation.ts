import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

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
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async ({ entityItem, relationName, targetHref }: SetRelationVariables) => {
      // Build the relation request via EntityItemRelation. Throws before any fetch if:
      //   - profile has no such relation (undefined)
      //   - relation is to-many (RelationCardinalityError)
      //   - template is absent (ABAC deny)
      const relation = entityItem.getRelation(relationName);
      if (!relation) {
        throw new Error(
          `Relation '${relationName}' not found in entity profile '${entityItem.profileEntity.name}'`,
        );
      }
      const baseReq = relation.setRequest(targetHref);

      // Attach If-Match from the item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, entityItem.etag);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, req);

      // Best-effort re-fetch of the parent item for fresh state + new ETag.
      // If the re-fetch throws, the committed write is still a success — resolve with
      // the pre-mutation item so the caller's onSuccess still fires. The onSettled
      // invalidation will trigger a background refetch to repair stale cache.
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
      // Invalidations run on BOTH success and error (e.g. write succeeded but re-fetch
      // failed) so stale caches are always busted.

      // Derive target entity name from the relation profile to build a scoped key.
      const relation = variables.entityItem.getRelation(variables.relationName);
      const targetName = relation?.profile.targetProfileLink?.name;

      // Invalidate the specific target item URL(s) only — not the whole target collection.
      // This avoids busting unrelated cached pages.
      if (targetName) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entityItem.byUrlForName(targetName, variables.targetHref),
        });
      }

      // Compose caller's onSettled LAST.
      await onSettled?.(item, error, variables, context, mutation);
    },
    ...restMutationOptions,
  });
}
