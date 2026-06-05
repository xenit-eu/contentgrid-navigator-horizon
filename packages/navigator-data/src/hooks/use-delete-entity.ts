import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "@contentgrid/typed-fetch";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

interface DeleteEntityParams {
  entityName: string;
  entityId: string;
}

export function useDeleteEntity() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteEntityParams) => {
      // Derive the item URL from the profile cache (staleTime: Infinity — always present)
      // rather than the entity-detail cache which may have been evicted (default gcTime: 5 min).
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      const collectionHref = entities?.find((e) => e.name === params.entityName)?.collectionHref;
      if (!collectionHref) throw new Error(`Unknown entity: ${params.entityName}`);

      await apiFetch(
        createRequest({ url: `${collectionHref}/${params.entityId}`, method: "DELETE" }, {}),
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityList(variables.entityName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.entityCount(variables.entityName) });
      queryClient.removeQueries({
        queryKey: queryKeys.entityDetail(variables.entityName, variables.entityId),
      });
    },
  });
}
