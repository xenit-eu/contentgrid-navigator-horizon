import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import type ProfileEntity from "../accessors/entity-profile";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

/**
 * Parameters for the shared relation-mutation helper.
 *
 * @internal Not exported from `hooks/index.ts`.
 */
type RelationMutationBaseParams<
  TRelation extends EntityItemToOneRelation | EntityItemToManyRelation,
  TInput,
> = {
  /**
   * The bound relation object (carries source item, link, profile metadata, and templates).
   */
  readonly relation: TRelation;
  /**
   * Profile of the target entity type; used to build the relation read-key for invalidation.
   */
  readonly targetProfile: ProfileEntity;
  /**
   * Build the op-specific `Request` from the mutation input. Called inside `mutationFn`.
   * The relation's request builders throw early when the template is absent (ABAC deny).
   */
  readonly buildRequest: (input: TInput) => Request;
  /**
   * The TanStack Query key for the relation read query that must be invalidated on settled.
   * Pass `queryKeys.toOneRelation.byUrl(...)` or `queryKeys.toManyRelation.byUrl(...)`.
   */
  readonly readKey: readonly unknown[];
  /**
   * Perform any op-specific target-item invalidations (set: single href, add: per href).
   * Called inside `onSettled`, before the caller's `onSettled` callback.
   * Omit (or pass `undefined`) when no target invalidation is needed (clear).
   */
  readonly invalidateTargets?: (queryClient: QueryClient, input: TInput) => Promise<void>;
  /**
   * Caller-supplied mutation options (`onSuccess` / `onSettled` are extracted and
   * composed — they must not appear in `mutationOptions` directly).
   */
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem | undefined, Error, TInput>,
    "mutationFn"
  >;
};

/**
 * Shared implementation for `useSetToOneRelation`, `useAddToManyRelation`, and
 * `useClearRelation`.
 *
 * Encapsulates:
 * - `If-Match` header attachment from `relation.source.etag`
 * - `fetchVoid` for the mutation (all three ops return 204)
 * - Best-effort re-fetch of the source item for a fresh ETag
 * - `onSuccess` → `setQueryData` on the source item's cache key
 * - `onSettled` → relation read-key invalidation + op-specific target invalidation
 * - Composition of caller `onSuccess` / `onSettled` LAST
 *
 * @internal Not exported from `hooks/index.ts`.
 */
export function useRelationMutationBase<
  TRelation extends EntityItemToOneRelation | EntityItemToManyRelation,
  TInput,
>({
  relation,
  buildRequest,
  readKey,
  invalidateTargets,
  mutationOptions,
}: RelationMutationBaseParams<TRelation, TInput>) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = mutationOptions ?? {};

  return useMutation<EntityItem | undefined, Error, TInput>({
    mutationFn: async (input) => {
      const source = relation.source;

      // Build op-specific request (PUT / POST / DELETE with text/uri-list body).
      const baseReq = buildRequest(input);

      // Attach If-Match from the source item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, source.etag);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, req);

      // Best-effort re-fetch of the source item for fresh state + new ETag.
      // If the re-fetch throws, the committed write is still a success — resolve with
      // undefined so onSettled invalidation still fires.
      try {
        const { object, etag } = await fetchHal<EntityItemShape>(
          apiFetch,
          new Request(source.selfLink.href),
        );
        return new EntityItem(object, source.profileEntity, etag);
      } catch {
        return undefined;
      }
    },
    onSuccess: async (item, input, onMutateResult, context) => {
      // Populate source item cache with fresh data + ETag (only when re-fetch succeeded).
      if (item) {
        queryClient.setQueryData(
          queryKeys.entityItem.byUrl(relation.source.profileEntity, item.selfLink.href),
          item,
        );
      }

      // Compose caller's onSuccess LAST — after cache is consistent.
      await onSuccess?.(item, input, onMutateResult, context);
    },
    onSettled: async (item, error, input, context, mutation) => {
      // Invalidate the relation read key so the read hook refetches after mutation.
      // Runs on BOTH success and error so stale caches are always busted.
      await queryClient.invalidateQueries({ queryKey: readKey });

      // Op-specific target-item invalidations (set/add only; omitted for clear).
      await invalidateTargets?.(queryClient, input);

      // Compose caller's onSettled LAST.
      await onSettled?.(item, error, input, context, mutation);
    },
    ...restMutationOptions,
  });
}
