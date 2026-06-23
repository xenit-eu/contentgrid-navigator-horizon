import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { addIfMatchHeader, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import { useNavigatorData } from "./context";

export interface UseDeleteEntityItemOptions {
  readonly mutationOptions?: Omit<UseMutationOptions<EntityItem, Error, EntityItem>, "mutationFn">;
}

/**
 * Mutation hook for deleting an entity item.
 *
 * Encodes the delete request via the HAL-FORMS codec (using the item's `_templates.delete`),
 * attaches `If-Match` with the current ETag to prevent concurrent conflict (RFC 9110),
 * and returns the deleted `EntityItem` on success (for reference in cache cleanup).
 *
 * On HTTP 412 (ETag mismatch) or 409 (integrity/required-relation), the error surfaces
 * as `ProblemDetailError` to the caller — the hook does NOT auto-retry.
 *
 * Cache behaviour on success:
 * - `removeQueries` on `entityItem.byUrl` (item is gone).
 * - `invalidateQueries` on `entityItemCollection.forEntity` so lists reflect the deletion.
 * - Caller's `onSuccess` runs after cache is consistent.
 *
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the deleted `EntityItem` (for reference)
 */
export function useDeleteEntityItem(options?: UseDeleteEntityItemOptions) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (item: EntityItem) => {
      const baseReq = item.deleteEntityItemRequest();
      const req = addIfMatchHeader(baseReq, item.etag);
      await fetchVoid(apiFetch, req);
      return item;
    },
    onSuccess: async (deletedItem, variables, onMutateResult, context) => {
      const { profileEntity } = deletedItem;
      queryClient.removeQueries({
        queryKey: queryKeys.entityItem.byUrl(profileEntity, deletedItem.selfLink.href),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });
      await onSuccess?.(deletedItem, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
