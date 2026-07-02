import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import { addIfMatchHeader, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import { useNavigatorData } from "./context";

export type UseDeleteRelationItemOptions = {
  readonly mutationOptions?: Omit<UseMutationOptions<EntityItem, Error, EntityItem>, "mutationFn">;
};

/**
 * Mutation hook for deleting an entity item that is part of a relation.
 *
 * Extends `useDeleteEntityItem` with relation-aware cache invalidation so the
 * relation table/slot reflects the removal without a manual refetch trigger.
 *
 * Works for both to-one and to-many relations:
 * - **to-one**: invalidates the exact `toOneRelation.byUrl` entry (one slot).
 * - **to-many**: invalidates all cached pages via `toManyRelation.forRelationName`
 *   because item removal can shift items across pages.
 *
 * Cache behaviour on success:
 * - `removeQueries` on `entityItem.byUrl` (item is gone).
 * - `invalidateQueries` on `entityItemCollection.forEntity` so global lists reflect the deletion.
 * - `invalidateQueries` on the relation read key (scoped by cardinality, see above).
 *
 * @param relation - The relation the item belongs to (to-one or to-many)
 * @param options  - Optional mutation options (onSuccess, onError, etc.)
 */
export function useDeleteRelationItem(
  relation: EntityItemToOneRelation | EntityItemToManyRelation,
  options?: UseDeleteRelationItemOptions,
) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation<EntityItem, Error, EntityItem>({
    mutationFn: async (item) => {
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

      const relationReadKey =
        relation instanceof EntityItemToOneRelation
          ? queryKeys.toOneRelation.byUrl(relation.name, relation.link.href)
          : queryKeys.toManyRelation.forRelationName(relation.name);
      await queryClient.invalidateQueries({ queryKey: relationReadKey });

      await onSuccess?.(deletedItem, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
