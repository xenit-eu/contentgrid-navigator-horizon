import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import { CONTENT_TYPE_JSON } from "../api/content-types";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

interface CreateEntityParams {
  entityName: string;
  data: Record<string, unknown>;
  file?: File;
}

export function useCreateEntity() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateEntityParams) => {
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      const collectionHref = entities?.find((e) => e.name === params.entityName)?.collectionHref;
      if (!collectionHref) throw new Error(`Unknown entity: ${params.entityName}`);

      if (params.file) {
        const formData = new FormData();
        formData.append("content", params.file);
        for (const [key, value] of Object.entries(params.data)) {
          if (value != null)
            formData.append(
              key,
              typeof value === "object"
                ? JSON.stringify(value)
                : String(value as string | number | boolean | bigint),
            );
        }
        const response = await apiFetch(
          createRequest(
            { url: collectionHref, method: "POST" },
            { body: Representation.createUnsafe(formData) },
          ),
        );
        return response.headers.get("Location") ?? "";
      }

      const response = await apiFetch(
        createRequest(
          { url: collectionHref, method: "POST" },
          {
            headers: { "Content-Type": CONTENT_TYPE_JSON },
            body: Representation.json(params.data),
          },
        ),
      );
      return response.headers.get("Location") ?? "";
    },
    onSuccess: (_location, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityList(variables.entityName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.entityCount(variables.entityName) });
    },
  });
}
