import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { HalObjectWithTemplateShape } from "@contentgrid/hal-forms/shape";
import { createRequest } from "@contentgrid/typed-fetch";
import UriTemplate from "@contentgrid/uri-template";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityInfo } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import type { EntityDetailResult, ItemTemplate } from "./use-entity-detail";

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
        // Expand the RFC 6570 item template from the entity profile's describes.item link.
        // This avoids constructing the URL via string concatenation.
        const itemUrl = new UriTemplate(entity.itemTemplateHref).expand({ id: entityId });
        const { object } = await fetchHal(apiFetch, itemUrl);
        const relLink = object.links.findLink(cgRels.relation, relationName);
        if (relLink) {
          relationUrl = relLink.href;
        }

        const entityShape = object.data as HalObjectWithTemplateShape<
          object,
          string,
          unknown,
          unknown
        >;
        const tpl = resolveTemplate(entityShape, `clear-${relationName}`);
        if (tpl) {
          const rawTplData = (entityShape as Record<string, unknown>)._templates as
            | Record<string, Record<string, unknown>>
            | undefined;
          clearTemplate = {
            method: tpl.request.method,
            target:
              typeof rawTplData?.[`clear-${relationName}`]?.target === "string"
                ? (rawTplData[`clear-${relationName}`].target as string)
                : null,
            contentType: tpl.contentType ?? null,
          };
        }
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
