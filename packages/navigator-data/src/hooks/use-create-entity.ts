import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import type ProfileEntity from "../accessors/entity-profile";
import type { EntityInstanceCreateRequestSpec } from "../api/requests";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

interface CreateEntityParams {
  /** Form values to create the entity with */
  values: HalFormValues<EntityInstanceCreateRequestSpec>;
}
/**
 * Hook to create a new entity using ProfileEntity's createEntity method.
 *
 * @param profileEntity - The entity profile containing the create template
 * @returns Mutation for creating an entity
 *
 * @example
 * ```tsx
 * const { data: profile } = useProfileEntity({ name: "invoices" });
 * const createInvoice = useCreateEntity(profile!);
 *
 * // In a form submit handler:
 * const values = createValues(profile.createTemplate!.template)
 *   .withValue("amount", 1250.00)
 *   .withValue("customer", customerUrl);
 *
 * createInvoice.mutate({ values }, {
 *   onSuccess: (result) => {
 *     console.log("Created entity:", result.data);
 *     console.log("At location:", result.location);
 *     navigate(`/entities/${result.id}`);
 *   }
 * });
 * ```
 */
export function useCreateEntity(profileEntity: ProfileEntity) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateEntityParams): Promise<unknown> => {
      if (!profileEntity.createTemplate) {
        throw new Error(`Entity ${profileEntity.name} does not support creation`);
      }

      // Use ProfileEntity's createEntity method with authenticated fetch
      const response = await profileEntity.createEntity(apiFetch, params.values);

      // Get the Location header
      return response.headers.get("Location");
    },
    onSuccess: (result) => {
      // Invalidate the entity list cache to refetch with the new item
      queryClient.invalidateQueries({
        queryKey: queryKeys.entityList(profileEntity.name),
      });

      // Cache the created entity in the detail query
      queryClient.setQueryData(queryKeys.entityDetail(profileEntity.name, result.id), result.data);
    },
  });
}
