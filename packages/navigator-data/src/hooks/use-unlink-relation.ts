import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "@contentgrid/typed-fetch";
import type ProfileEntity from "../accessors/entity-profile";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

interface UnlinkRelationParams {
  entityName: string;
  entityId: string;
  relationName: string;
  /** Target item ID — required for many-to-many, omit for many-to-one (clears the relation). */
  targetId?: string;
}

export function useUnlinkRelation() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityName, entityId, relationName, targetId }: UnlinkRelationParams) => {
      const entities = queryClient.getQueryData<ProfileEntity[]>(queryKeys.profileEntities());
      const collectionHref = entities?.find((e) => e.name === entityName)?.collectionLink.href;
      if (!collectionHref) throw new Error(`Unknown entity: ${entityName}`);

      const url = targetId
        ? `${collectionHref}/${entityId}/${relationName}/${targetId}`
        : `${collectionHref}/${entityId}/${relationName}`;

      await apiFetch(createRequest({ url, method: "DELETE" }, {}));
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
