import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItem } from "../accessors/entity-item";
import type ProfileEntity from "../accessors/entity-profile";
import { fetchHalObject } from "../api/hal-client";
import type { EntityInstanceCreateRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

export interface UseCreateEntityItemOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem, Error, HalFormValues<EntityInstanceCreateRequestSpec>>,
    "mutationFn"
  >;
}

/**
 * Mutation hook for creating a new entity item.
 *
 * Encodes the create-form values via the HAL-FORMS codec, POSTs to the entity collection,
 * and returns the newly created `EntityItem` on success.
 * Automatically invalidates all collection queries for the entity type after a successful create.
 *
 * @param profileEntity - Entity profile containing the create-form template
 * @param options - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the newly created `EntityItem`
 */
export function useCreateEntityItem(
  profileEntity: ProfileEntity,
  options?: UseCreateEntityItemOptions,
) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (values: HalFormValues<EntityInstanceCreateRequestSpec>) => {
      const request = profileEntity.createEntityItemRequest(values);
      const object = await fetchHalObject<EntityItemShape>(apiFetch, request);
      return new EntityItem(object, profileEntity);
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      const { href } = item.selfLink;
      queryClient.setQueryData(queryKeys.entityItem.byUrl(profileEntity, href), item);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
