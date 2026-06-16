import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import type ProfileEntity from "../accessors/entity-profile";
import { CONTENT_TYPE_URI_LIST } from "../api/content-types";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

interface LinkRelationParams {
  entityName: string;
  entityId: string;
  relationName: string;
  targetUri: string;
}

export function useLinkRelation() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityName, entityId, relationName, targetUri }: LinkRelationParams) => {
      const entities = queryClient.getQueryData<ProfileEntity[]>(queryKeys.profileEntities());
      const collectionHref = entities?.find((e) => e.name === entityName)?.collectionLink.href;
      if (!collectionHref) throw new Error(`Unknown entity: ${entityName}`);

      await apiFetch(
        createRequest(
          { url: `${collectionHref}/${entityId}/${relationName}`, method: "PUT" },
          {
            headers: { "Content-Type": CONTENT_TYPE_URI_LIST },
            body: Representation.createUnsafe(targetUri),
          },
        ),
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entityRelations(
          variables.entityName,
          variables.entityId,
          variables.relationName,
        ),
      });
    },
  });
}
