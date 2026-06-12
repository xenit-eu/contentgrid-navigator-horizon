import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import type { EntityInfo } from "../types/entity";
import type { EntitySchema } from "../types/entity";
import { convertToString } from "../utils/format";
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
      const entity = entities?.find((e) => e.name === params.entityName);
      if (!entity) throw new Error(`Unknown entity: ${params.entityName}`);

      const schema = queryClient.getQueryData<EntitySchema>(
        queryKeys.entitySchema(params.entityName),
      );

      const createTemplate = schema?.createFormTemplate;
      if (!createTemplate) {
        throw new Error(
          `Operation not supported: no "create-form" template on profile for ${params.entityName}`,
        );
      }

      const targetUrl = createTemplate.target ?? entity.collectionHref;
      const method = createTemplate.method;
      const contentType = createTemplate.contentType ?? "application/json";

      if (params.file) {
        const formData = new FormData();
        formData.append("content", params.file);
        for (const [key, value] of Object.entries(params.data)) {
          if (value == null) continue;
          formData.append(key, convertToString(value));
        }
        const response = await apiFetch(
          createRequest(
            { url: targetUrl, method },
            { body: Representation.createUnsafe(formData) },
          ),
        );
        return response.headers.get("Location") ?? "";
      }

      const response = await apiFetch(
        createRequest(
          { url: targetUrl, method },
          {
            headers: { "Content-Type": contentType },
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
