import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItem } from "../../accessors/entity-item";
import { addIfMatchHeader, fetchHal } from "../../api/hal-client";
import type { EntityInstanceUpdateRequestSpec } from "../../api/requests";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import { useNavigatorData } from "../context";

export interface UseUpdateEntityItemOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem, Error, HalFormValues<EntityInstanceUpdateRequestSpec>>,
    "mutationFn"
  >;
}

/**
 * Mutation hook for updating an entity item.
 *
 * Encodes the update values via the HAL-FORMS codec (using the item's `_templates.default`),
 * attaches `If-Match` with the current ETag to prevent concurrent update conflicts (RFC 9110),
 * and returns the updated `EntityItem` with its fresh ETag on success.
 *
 * On HTTP 412 (ETag mismatch / unsatisfied-version), the error surfaces as `ProblemDetailError`
 * to the caller — the hook does NOT auto-retry. Callers must re-fetch, re-apply, and retry.
 *
 * Cache behaviour on success:
 * - `setQueryData` on `entityItem.byUrl` with the fresh item (ETag carry-through).
 * - `invalidateQueries` on `entityItemCollection.forEntity` so lists reflect the update.
 * - Caller's `onSuccess` runs after cache is consistent.
 *
 * @param entityItem - The entity item to update (provides template, URL, ETag)
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the updated `EntityItem`
 */
export function useUpdateEntityItem(entityItem: EntityItem, options?: UseUpdateEntityItemOptions) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (values: HalFormValues<EntityInstanceUpdateRequestSpec>) => {
      const baseReq = entityItem.editEntityRequest(values);
      const req = addIfMatchHeader(baseReq, entityItem.etag);
      const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, req);
      return new EntityItem(object, profileEntity, etag);
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      queryClient.setQueryData(queryKeys.entityItem.byUrl(profileEntity, item.selfLink.href), item);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
