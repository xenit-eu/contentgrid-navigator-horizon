import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import type ProfileEntity from "../accessors/profile";
import { CONTENT_TYPE_JSON } from "../api/content-types";
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
      const entities = queryClient.getQueryData<ProfileEntity[]>(queryKeys.profileEntities());
      const collectionHref = entities?.find((e) => e.name === params.entityName)?.collectionLink
        .href;
      if (!collectionHref) throw new Error(`Unknown entity: ${params.entityName}`);

      if (params.file) {
        const formData = new FormData();
        formData.append("content", params.file);
        for (const [key, value] of Object.entries(params.data)) {
          if (value == null) continue;
          formData.append(key, convertToString(value));
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
