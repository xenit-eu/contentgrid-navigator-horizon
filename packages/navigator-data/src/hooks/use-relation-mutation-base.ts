import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemRelation } from "../accessors/entity-item";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

/**
 * Minimum variable shape required by the shared mutation helper.
 * All three relation-mutation hooks extend this with op-specific fields.
 */
type RelationBaseVariables = {
  readonly entityItem: EntityItem;
  readonly relationName: string;
};

/**
 * Parameters for the shared relation-mutation helper.
 *
 * @internal Not exported from `hooks/index.ts`.
 */
type RelationMutationBaseParams<TVars extends RelationBaseVariables> = {
  /**
   * Build the op-specific `Request` from the resolved `EntityItemRelation` and the
   * full variables object.  Called inside `mutationFn`; the relation is guaranteed to
   * be non-null at this point (the null check happens before this call).
   */
  readonly buildRequest: (relation: EntityItemRelation, vars: TVars) => Request;
  /**
   * Perform any query-cache invalidations that are specific to the operation.
   * Called inside `onSettled`, before the caller's `onSettled` callback.
   * Omit (or pass `undefined`) when no target invalidation is needed (e.g. clear).
   */
  readonly invalidateTargets?: (queryClient: QueryClient, vars: TVars) => Promise<void>;
  /**
   * Caller-supplied mutation options (`onSuccess` / `onSettled` are extracted and
   * composed — they must not appear in `mutationOptions` directly).
   */
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, TVars>,
    "mutationFn"
  >;
};

/**
 * Shared implementation for `useSetRelation`, `useAddRelation`, and `useClearRelation`.
 *
 * Encapsulates:
 * - Relation-not-found guard (throws before any fetch)
 * - `If-Match` header attachment
 * - `fetchVoid` for the mutation (all three ops return 204)
 * - Best-effort re-fetch of the parent item for a fresh ETag
 * - `onSuccess` → `setQueryData` on the parent item's cache key
 * - `onSettled` → op-specific target invalidation, then caller's `onSettled`
 *
 * @internal Not exported from `hooks/index.ts`.
 */
export function useRelationMutationBase<TVars extends RelationBaseVariables>({
  buildRequest,
  invalidateTargets,
  mutationOptions,
}: RelationMutationBaseParams<TVars>) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = mutationOptions ?? {};

  return useMutation<EntityItem | undefined, Error, TVars>({
    mutationFn: async (vars) => {
      const { entityItem, relationName } = vars;

      // Resolve the relation. Throws before any fetch when:
      //   - profile has no such relation (undefined → guard below)
      //   - wrong cardinality (RelationCardinalityError, thrown inside buildRequest)
      //   - template absent (ABAC deny, thrown inside buildRequest)
      const relation = entityItem.getRelation(relationName);
      if (!relation) {
        throw new Error(
          `Relation '${relationName}' not found in entity profile '${entityItem.profileEntity.name}'`,
        );
      }

      // Build op-specific request (PUT / POST / DELETE with text/uri-list body).
      const baseReq = buildRequest(relation, vars);

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
      // Op-specific invalidations run on BOTH success and error so stale caches are
      // always busted (e.g. write succeeded but re-fetch failed).
      await invalidateTargets?.(queryClient, variables);

      // Compose caller's onSettled LAST.
      await onSettled?.(item, error, variables, context, mutation);
    },
    ...restMutationOptions,
  });
}
