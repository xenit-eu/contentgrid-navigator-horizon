import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import { CONTENT_TYPE_JSON } from "../api/content-types";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

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
      const collectionHref = entities?.find((e) => e.name === params.entityName)?.collectionHref;
      if (!collectionHref) throw new Error(`Unknown entity: ${params.entityName}`);

      const itemUrl = `${collectionHref}/${params.entityId}`;

      const cached = queryClient.getQueryData(
        queryKeys.entityDetail(params.entityName, params.entityId),
      ) as { etag: string | null } | undefined;
      if (!cached?.etag) {
        throw new Error(
          `No ETag cached for ${params.entityName}/${params.entityId} — fetch the item before mutating`,
        );
      }

      await apiFetch(
        createRequest(
          { url: itemUrl, method: "PATCH" },
          {
            headers: { "Content-Type": CONTENT_TYPE_JSON, "If-Match": cached.etag },
            body: Representation.json(params.data),
          },
        ),
      );

      if (params.file && params.contentAttributeName) {
        const contentUrl = `${itemUrl}/${params.contentAttributeName}`;
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
