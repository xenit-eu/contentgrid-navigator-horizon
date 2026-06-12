import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { HalObjectWithTemplateShape } from "@contentgrid/hal-forms/shape";
import { createRequest } from "@contentgrid/typed-fetch";
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
  /**
   * The entity item's `self` link href, as returned by the server on the item
   * resource. Used to re-fetch the item when the detail cache is absent or
   * incomplete — the URL is server-provided, never constructed client-side.
   */
  selfHref: string;
  /** Target item ID — required for many-to-many, omit for many-to-one (clears the relation). */
  targetId?: string;
}

export function useUnlinkRelation() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityName,
      entityId,
      relationName,
      selfHref,
      targetId,
    }: UnlinkRelationParams) => {
      // Guard: entity must be known in the profile cache.
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      if (!entities?.find((e) => e.name === entityName)) {
        throw new Error(`Unknown entity: ${entityName}`);
      }

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(entityName, entityId),
      );

      let relationUrl: string | null = cached?.relationLinks[relationName] ?? null;
      let clearTemplate: ItemTemplate | null = cached?.templates[`clear-${relationName}`] ?? null;

      if (!relationUrl || !clearTemplate) {
        // Item detail cache is absent or incomplete — live-fetch the item via its
        // server-provided self link (never a client-constructed URL).
        const { object } = await fetchHal(apiFetch, selfHref);
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
