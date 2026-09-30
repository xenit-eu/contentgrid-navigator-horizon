import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { fetchVoid } from "../../api/hal-client";
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
 * - `If-Match` header attachment — currently not sent. To-many relations have no ETag, so
 *   none is needed there; for to-one relations see FIXME(ACC-3186) at the call site below
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

      // No If-Match is sent. Only to-one relations (one-to-one, many-to-one) have an
      // ETag; to-many relations (one-to-many, many-to-many) have none, so add/clear on a
      // to-many relation is correctly unconditional.
      //
      // FIXME(ACC-3186): to-one set/clear should send If-Match with the relation's own
      // ETag. relation.source.etag (the previous value here) is the WRONG etag: per
      // https://docs.contentgrid.com/guides/09_app_api/02_api_usage/index.html#conditional-requests
      // a to-one relation is its own conditional-request resource, distinct from both the
      // source and target entity items. That ETag is only exposed on the 302 response
      // returned when GETing the relation link — our fetch client (see hal-client.ts)
      // follows redirects by default, so it is never seen here. Needs a manual-redirect
      // fetch path; then, for to-one relations only:
      // const req = addIfMatchHeader(baseReq, <to-one relation ETag>);

      // Execute mutation — 204 No Content.
      await fetchVoid(apiFetch, baseReq);
    },
    onSuccess: async (_, input, onMutateResult, context) => {
      // Compose caller's onSuccess LAST.
      await onSuccess?.(_, input, onMutateResult, context);
    },
    onSettled: async (_, error, input, context, mutation) => {
      // Invalidate the relation read key so the read hook refetches after mutation.
      // Runs on BOTH success and error so stale caches are always busted.
      // relation.name is always available — no profile lookup needed.
      //
      // to-many uses the forRelationName prefix (all cached pages), not byUrl for
      // just the base link: once a caller has paged past page 1 (useAddToManyRelation)
      // or is about to reset back to page 1 (useClearRelation), the currently-viewed
      // page's cache key is a different URL than relation.link.href, so a byUrl-only
      // invalidation would silently miss it — same rationale as useUnlinkRelation /
      // useDeleteRelationItem, which already invalidate this way for to-many.
      const readKey =
        relation instanceof EntityItemToOneRelation
          ? queryKeys.toOneRelation.byUrl(relation.name, relation.link.href)
          : queryKeys.toManyRelation.forRelationName(relation.name);
      await queryClient.invalidateQueries({ queryKey: readKey });

      // Invalidate the source item's entityItem cache entry unconditionally.
      // Relation set/add/clear may bump the source item's ETag — a lazy refetch keeps
      // the cached ETag valid and avoids a 412 on the next entity-item operation.
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
