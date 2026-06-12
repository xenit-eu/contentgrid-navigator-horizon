import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import { PreconditionFailedError, ProblemDetailError } from "../api/errors";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import type { EntityDetailResult } from "./use-entity-detail";

interface UpdateEntityParams {
  entityName: string;
  entityId: string;
  data: Record<string, unknown>;
  file?: File;
  contentAttributeName?: string;
}

export function useUpdateEntity() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateEntityParams) => {
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      const entity = entities?.find((e) => e.name === params.entityName);
      if (!entity) throw new Error(`Unknown entity: ${params.entityName}`);

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(params.entityName, params.entityId),
      );
      if (!cached?.etag) {
        throw new Error(
          `No ETag cached for ${params.entityName}/${params.entityId} — fetch the item before mutating`,
        );
      }

      const updateTemplate = cached.templates["default"];
      if (!updateTemplate) {
        throw new Error(
          `Operation not supported: no "default" template on ${params.entityName}/${params.entityId}`,
        );
      }

      const itemUrl = updateTemplate.target ?? cached.selfHref;
      const method = updateTemplate.method;
      const contentType = updateTemplate.contentType ?? "application/json";

      try {
        await apiFetch(
          createRequest(
            { url: itemUrl, method },
            {
              headers: { "Content-Type": contentType, "If-Match": cached.etag },
              body: Representation.json(params.data),
            },
          ),
        );
      } catch (e) {
        if (e instanceof ProblemDetailError && e.problemDetail.status === 412) {
          throw new PreconditionFailedError(e.problemDetail);
        }
        throw e;
      }

      if (params.file && params.contentAttributeName) {
        // Resolve the content upload URL from the cg:content link — never string-concat.
        const contentUrl = cached.contentLinks[params.contentAttributeName];
        if (!contentUrl) {
          throw new Error(
            `No content link for attribute "${params.contentAttributeName}" on ${params.entityName}/${params.entityId}`,
          );
        }
        await apiFetch(
          createRequest(
            { url: contentUrl, method: "PUT" },
            {
              headers: { "Content-Type": params.file.type || "application/octet-stream" },
              body: Representation.createUnsafe(params.file),
            },
          ),
        );
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entityDetail(variables.entityName, variables.entityId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.entityList(variables.entityName) });
    },
  });
}
