import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { HalObjectWithTemplateShape } from "@contentgrid/hal-forms/shape";
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
  /**
   * The entity item's `self` link href, as returned by the server on the item
   * resource. Used to re-fetch the item when the detail cache is absent or
   * incomplete — the URL is server-provided, never constructed client-side.
   */
  selfHref: string;
  targetUri: string;
}

export function useLinkRelation() {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityName,
      entityId,
      relationName,
      selfHref,
      targetUri,
    }: LinkRelationParams) => {
      // Guard: entity must be known in the profile cache.
      const entities = queryClient.getQueryData<EntityInfo[]>(queryKeys.profile());
      if (!entities?.find((e) => e.name === entityName)) {
        throw new Error(`Unknown entity: ${entityName}`);
      }

      const cached = queryClient.getQueryData<EntityDetailResult>(
        queryKeys.entityDetail(entityName, entityId),
      );

      let relationUrl: string | null = cached?.relationLinks[relationName] ?? null;
      let linkTemplate: ItemTemplate | null =
        cached?.templates[`set-${relationName}`] ??
        cached?.templates[`add-${relationName}`] ??
        null;

      if (!relationUrl || !linkTemplate) {
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
        const rawTplData = (entityShape as Record<string, unknown>)._templates as
          | Record<string, Record<string, unknown>>
          | undefined;
        const setTpl = resolveTemplate(entityShape, `set-${relationName}`);
        const addTpl = resolveTemplate(entityShape, `add-${relationName}`);
        const tpl = setTpl ?? addTpl;
        const tplKey = setTpl ? `set-${relationName}` : `add-${relationName}`;
        if (tpl) {
          linkTemplate = {
            method: tpl.request.method,
            target:
              typeof rawTplData?.[tplKey]?.target === "string"
                ? (rawTplData[tplKey].target as string)
                : null,
            contentType: tpl.contentType ?? null,
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
