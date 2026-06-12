import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Representation, createRequest } from "@contentgrid/typed-fetch";
import { CONTENT_TYPE_URI_LIST } from "../api/content-types";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import type { EntityDetailResult, ItemTemplate } from "./use-entity-detail";

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
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      const entity = entities?.find((e) => e.name === entityName);
      if (!entity) throw new Error(`Unknown entity: ${entityName}`);

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(entityName, entityId),
      );

      let relationUrl: string | null = cached?.relationLinks[relationName] ?? null;
      let linkTemplate: ItemTemplate | null =
        cached?.templates[`set-${relationName}`] ??
        cached?.templates[`add-${relationName}`] ??
        null;

      if (!relationUrl || !linkTemplate) {
        // Item detail cache is absent or incomplete — do a live fetch.
        const { object } = await fetchHal(apiFetch, `${entity.collectionHref}/${entityId}`);
        const relLink = object.links.findLink(cgRels.relation, relationName);
        if (relLink) {
          relationUrl = relLink.href;
        }

        const rawTemplates = (object.data as Record<string, unknown>)._templates as
          | Record<string, { method?: string; target?: string; contentType?: string }>
          | undefined;
        const rawTpl =
          rawTemplates?.[`set-${relationName}`] ?? rawTemplates?.[`add-${relationName}`];
        if (rawTpl && typeof rawTpl.method === "string") {
          linkTemplate = {
            method: rawTpl.method,
            target: typeof rawTpl.target === "string" ? rawTpl.target : null,
            contentType: typeof rawTpl.contentType === "string" ? rawTpl.contentType : null,
          };
        }
      }

      if (!linkTemplate) {
        throw new Error(
          `Operation not supported: no "set-${relationName}" or "add-${relationName}" template on ${entityName}/${entityId}`,
        );
      }

      if (!relationUrl) {
        throw new Error(`No relation link for "${relationName}" on ${entityName}/${entityId}`);
      }

      const url = linkTemplate.target ?? relationUrl;
      const method = linkTemplate.method;
      const contentType = linkTemplate.contentType ?? CONTENT_TYPE_URI_LIST;

      await apiFetch(
        createRequest(
          { url, method },
          {
            headers: { "Content-Type": contentType },
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
