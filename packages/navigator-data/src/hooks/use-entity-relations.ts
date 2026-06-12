import { useQuery } from "@tanstack/react-query";
import { HalObject, HalSlice } from "@contentgrid/hal";
import { ianaRelations } from "@contentgrid/hal/rels";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useEntityDetail } from "./use-entity-detail";

export interface RelatedItem {
  data: Record<string, unknown>;
  selfHref: string;
  id: string;
}

/**
 * Extracts the entity id from an item's data or self href.
 *
 * Entity-item responses expose id as a top-level JSON field per the HAL contract.
 * Fall back to last URL path segment only if the field is genuinely absent
 * (should not happen on a well-formed ContentGrid response).
 */
function extractId(data: Record<string, unknown>, selfHref: string): string {
  if (typeof data.id === "string" && data.id) return data.id;
  return selfHref.split("/").pop() ?? "";
}

async function fetchEntityRelations(
  apiFetch: Parameters<typeof fetchHal>[0],
  relationHref: string,
): Promise<RelatedItem[]> {
  try {
    const { object } = await fetchHal<Record<string, unknown>>(apiFetch, relationHref);

    // Collection response (to-many): has _embedded — reuse the already-fetched object
    if (object.data._embedded) {
      return HalSlice.from<Record<string, unknown>>(object).items.map((item) => {
        const selfLink = item.links.findLink(ianaRelations.self);
        const selfHref = selfLink?.href ?? "";
        const rawData = item.data as Record<string, unknown>;
        return {
          data: { ...rawData },
          selfHref,
          id: extractId(rawData, selfHref),
        };
      });
    }

    // Single item response (to-one): use the already-fetched object directly
    const selfLink = object.links.findLink(ianaRelations.self);
    const selfHref = selfLink?.href ?? "";
    if (Object.keys(object.data).length === 0 && !selfLink) return [];
    const rawData = object.data as Record<string, unknown>;
    return [
      {
        data: { ...rawData },
        selfHref,
        id: extractId(rawData, selfHref),
      },
    ];
  } catch (err) {
    // 404 means no linked item (empty to-one relation)
    if (err instanceof ProblemDetailError && err.problemDetail.status === 404) return [];
    throw err;
  }
}

export function useEntityRelations(entityName: string, entityId: string, relationName: string) {
  const { apiFetch } = useNavigatorData();
  const { data: detail } = useEntityDetail(entityName, entityId);

  // Resolve the relation href from the entity item's cg:relation links
  const halObj = detail ? new HalObject({ _links: detail.links } as never) : null;
  const relationLink = halObj?.links.findLink(cgRels.relation, relationName);
  const relationHref = relationLink?.href;

  return useQuery({
    queryKey: queryKeys.entityRelations(entityName, entityId, relationName),
    queryFn: () => fetchEntityRelations(apiFetch, relationHref!),
    enabled: !!relationHref,
  });
}

// Re-export for convenience
export { HalSlice };
