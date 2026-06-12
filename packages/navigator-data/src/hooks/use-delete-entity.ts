import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "@contentgrid/typed-fetch";
import { PreconditionFailedError, ProblemDetailError } from "../api/errors";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import type { EntityDetailResult } from "./use-entity-detail";

interface DeleteEntityParams {
  entityName: string;
  entityId: string;
}

export function useDeleteEntity() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteEntityParams) => {
      // Guard: entity must be known in the profile cache.
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      if (!entities?.find((e) => e.name === params.entityName)) {
        throw new Error(`Unknown entity: ${params.entityName}`);
      }

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(params.entityName, params.entityId),
      );
      if (!cached?.etag) {
        throw new Error(
          `No ETag cached for ${params.entityName}/${params.entityId} — fetch the item before deleting`,
        );
      }

      const deleteTemplate = cached.templates["delete"];
      if (!deleteTemplate) {
        throw new Error(
          `Operation not supported: no "delete" template on ${params.entityName}/${params.entityId}`,
        );
      }

      const itemUrl = deleteTemplate.target ?? cached.selfHref;
      const method = deleteTemplate.method;

      try {
        await apiFetch(
          createRequest({ url: itemUrl, method }, { headers: { "If-Match": cached.etag } }),
        );
      } catch (e) {
        if (e instanceof ProblemDetailError && e.problemDetail.status === 412) {
          throw new PreconditionFailedError(e.problemDetail);
        }
        throw e;
      }
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
