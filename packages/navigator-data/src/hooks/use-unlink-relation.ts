import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "@contentgrid/typed-fetch";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import type { EntityDetailResult, ItemTemplate } from "./use-entity-detail";

function parseRawTemplate(
  rawTemplates:
    | Record<string, { method?: string; target?: string; contentType?: string }>
    | undefined,
  key: string,
): ItemTemplate | null {
  const rawTpl = rawTemplates?.[key];
  if (!rawTpl || typeof rawTpl.method !== "string") return null;
  return {
    method: rawTpl.method,
    target: typeof rawTpl.target === "string" ? rawTpl.target : null,
    contentType: typeof rawTpl.contentType === "string" ? rawTpl.contentType : null,
  };
}

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
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      const entity = entities?.find((e) => e.name === entityName);
      if (!entity) throw new Error(`Unknown entity: ${entityName}`);

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(entityName, entityId),
      );

      let relationUrl: string | null = cached?.relationLinks[relationName] ?? null;
      let clearTemplate: ItemTemplate | null = cached?.templates[`clear-${relationName}`] ?? null;

      if (!relationUrl || !clearTemplate) {
        // Item detail cache is absent or incomplete — do a live fetch.
        const { object } = await fetchHal(apiFetch, `${entity.collectionHref}/${entityId}`);
        const relLink = object.links.findLink(cgRels.relation, relationName);
        if (relLink) {
          relationUrl = relLink.href;
        }

        const rawTemplates = (object.data as Record<string, unknown>)._templates as
          | Record<string, { method?: string; target?: string; contentType?: string }>
          | undefined;
        clearTemplate = parseRawTemplate(rawTemplates, `clear-${relationName}`);
      }

      if (!clearTemplate) {
        throw new Error(
          `Operation not supported: no "clear-${relationName}" template on ${entityName}/${entityId}`,
        );
      }

      if (!relationUrl) {
        throw new Error(`No relation link for "${relationName}" on ${entityName}/${entityId}`);
      }

      // For many-to-many, append the targetId to the relation URL.
      const url = clearTemplate.target ?? (targetId ? `${relationUrl}/${targetId}` : relationUrl);
      const method = clearTemplate.method;

      await apiFetch(createRequest({ url, method }, {}));
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
