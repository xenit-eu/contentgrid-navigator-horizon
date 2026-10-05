import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import type { EntityItem } from "../../accessors/entity-item";
import { addIfMatchHeader, fetchVoid } from "../../api/hal-client";
import type { EntityInstanceUpdateRequestSpec } from "../../api/requests";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";

export interface UseUpdateEntityItemOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<void, Error, HalFormValues<EntityInstanceUpdateRequestSpec>>,
    "mutationFn"
  >;
}

/**
 * Mutation hook for updating an entity item.
 *
 * Encodes the update values via the HAL-FORMS codec (using the item's `_templates.default`) and
 * attaches `If-Match` with the current ETag to prevent concurrent update conflicts (RFC 9110).
 * The PUT answers 204 No Content, so the mutation succeeds once the PUT does.
 *
 * On HTTP 412 (ETag mismatch / unsatisfied-version), the error surfaces as `ProblemDetailError`
 * to the caller — the hook does NOT auto-retry. Callers must re-fetch (`useReloadEntityItem`),
 * re-apply, and retry.
 *
 * Cache behaviour on success:
 * - `invalidateQueries` on `entityItem.byUrl`: a shown item is re-fetched (cancelling any fetch
 *   already in flight, which could return the version from before the PUT) and holds the new values
 *   and ETag before the mutation settles. A failed re-fetch shows as the item query's own error.
 * - `invalidateQueries` on `entityItemCollection.forEntity` so lists reflect the update.
 * - Caller's `onSuccess` runs after cache is consistent.
 *
 * @param entityItem - The entity item to update (provides template, URL, ETag)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result
 */
export function useUpdateEntityItem(entityItem: EntityItem, options?: UseUpdateEntityItemOptions) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (values: HalFormValues<EntityInstanceUpdateRequestSpec>) => {
      const req = addIfMatchHeader(entityItem.editEntityRequest(values), entityItem.etag);
      await fetchVoid(apiFetch, req);
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItem.byUrl(profileEntity, entityItem.selfLink.href),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
