import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { addIfMatchHeader, fetchVoid } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";

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
   * Build the op-specific `Request` from the mutation input. Called inside `mutationFn`.
   * The relation's request builders throw early when the template is absent (ABAC deny).
   */
  readonly buildRequest: (input: TInput) => Request;
  /**
   * Caller-supplied mutation options (`onSuccess` / `onSettled` are extracted and
   * composed — they must not appear in `mutationOptions` directly).
   */
  readonly mutationOptions?: Omit<UseMutationOptions<void, Error, TInput>, "mutationFn">;
};

/**
 * Shared implementation for `useSetToOneRelation`, `useAddToManyRelation`, and
 * `useClearRelation`.
 *
 * Encapsulates:
 * - `If-Match` header attachment from `relation.source.etag`
 * - `fetchVoid` for the mutation (all three ops return 204)
 * - `onSettled` → relation read-key invalidation only (relation responses must
 *   be refetched; entity items themselves do not change when a relation is set/cleared)
 * - Composition of caller `onSuccess` / `onSettled` LAST
 *
 * The target entity name is derived synchronously from
 * `relation.profileRelation.targetProfileLink?.name` — no profile query needed.
 * Read-key invalidation is skipped only when `targetProfileLink` is absent
 * (degenerate profile without a target-entity link).
 *
 * @internal Not exported from `hooks/index.ts`.
 */
export function useRelationMutationBase<
  TRelation extends EntityItemToOneRelation | EntityItemToManyRelation,
  TInput,
>({ relation, buildRequest, mutationOptions }: RelationMutationBaseParams<TRelation, TInput>) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = mutationOptions ?? {};

  return useMutation<void, Error, TInput>({
    mutationFn: async (input) => {
      // Build op-specific request (PUT / POST / DELETE with text/uri-list body).
      const baseReq = buildRequest(input);

      // Attach If-Match from the source item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, relation.source.etag);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, req);
    },
    onSuccess: async (_, input, onMutateResult, context) => {
      // Compose caller's onSuccess LAST.
      await onSuccess?.(_, input, onMutateResult, context);
    },
    onSettled: async (_, error, input, context, mutation) => {
      // Invalidate the relation read key so the read hook refetches after mutation.
      // Runs on BOTH success and error so stale caches are always busted.
      // relation.name is always available — no profile lookup needed.
      const readKey =
        relation instanceof EntityItemToOneRelation
          ? queryKeys.toOneRelation.byUrl(relation.name, relation.link.href)
          : queryKeys.toManyRelation.byUrl(relation.name, relation.link.href);
      await queryClient.invalidateQueries({ queryKey: readKey });

      // Invalidate the source item's entityItem cache entry unconditionally.
      // Relation set/add/clear is gated on the source item's ETag and may bump it — a
      // lazy refetch keeps the cached ETag valid and avoids a 412 on the next operation.
      // relation.source.profileEntity and relation.source.selfLink.href are always available.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItem.byUrl(
          relation.source.profileEntity,
          relation.source.selfLink.href,
        ),
      });

      // Compose caller's onSettled LAST.
      await onSettled?.(_, error, input, context, mutation);
    },
    ...restMutationOptions,
  });
}
