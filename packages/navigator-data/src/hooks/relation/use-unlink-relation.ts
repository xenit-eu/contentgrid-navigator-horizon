import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { addIfMatchHeader, fetchVoid } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";

export type UseUnlinkRelationOptions = {
  readonly mutationOptions?: Omit<UseMutationOptions<void, Error, EntityItem>, "mutationFn">;
};

/**
 * Mutation hook for removing a single item from a to-many relation.
 *
 * **Workaround**: uses `relation.unlinkItemRequest(item)` which constructs
 * `DELETE ${relation.link.href}/${item.id}` by hand. No HAL-FORMS template
 * exists yet; the server returns 403 if ABAC denies the operation.
 * Replace with a template-driven hook when the server adds the template.
 *
 * Attaches `If-Match` from `relation.source.etag` to guard against concurrent
 * source-item mutations.
 *
 * Cache behaviour on settled:
 * - Invalidates all cached pages for this relation via
 *   `toManyRelation.forRelationName` — items may shift across pages after
 *   an unlink so a single-page bust is insufficient.
 * - Invalidates `entityItem.byUrl` for the source item (ETag may change).
 *
 * @param relation - The bound to-many relation
 * @param options  - Optional mutation options (onSuccess, onError, etc.)
 */
export function useUnlinkRelation(
  relation: EntityItemToManyRelation,
  options?: UseUnlinkRelationOptions,
) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, onSettled, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation<void, Error, EntityItem>({
    mutationFn: async (item) => {
      const baseReq = relation.unlinkItemRequest(item);
      const req = addIfMatchHeader(baseReq, relation.source.etag);
      await fetchVoid(apiFetch, req);
    },
    onSuccess: async (_, item, onMutateResult, context) => {
      await onSuccess?.(_, item, onMutateResult, context);
    },
    onSettled: async (_, error, item, context, mutation) => {
      // Bust all cached pages — items can shift across pages after a removal.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.toManyRelation.forRelationName(relation.name),
      });
      // Source item ETag may change — keep it fresh to avoid 412 on next mutation.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItem.byUrl(
          relation.source.profileEntity,
          relation.source.selfLink.href,
        ),
      });
      await onSettled?.(_, error, item, context, mutation);
    },
    ...restMutationOptions,
  });
}
