import { useQuery } from "@tanstack/react-query";
import { HalSlice } from "@contentgrid/hal";
import { ianaRelations } from "@contentgrid/hal/rels";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { fetchHal } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useEntityDetail } from "./use-entity-detail";

export interface RelatedItem {
  data: Record<string, unknown>;
  selfHref: string;
  id: string;
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
        return {
          data: { ...item.data },
          selfHref,
          id: selfHref.split("/").pop() ?? "",
        };
      });
    }

    // Single item response (to-one): use the already-fetched object directly
    const selfLink = object.links.findLink(ianaRelations.self);
    const selfHref = selfLink?.href ?? "";
    if (Object.keys(object.data).length === 0 && !selfLink) return [];
    return [
      {
        data: { ...object.data },
        selfHref,
        id: selfHref.split("/").pop() ?? "",
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

  // Resolve the relation href from the already-parsed relationLinks map on the detail result.
  // Using detail.relationLinks avoids re-constructing a HalObject from raw _links JSON
  // (which is fragile when the server omits the curies block).
  const relationHref = detail?.relationLinks[relationName];

  return useQuery({
    queryKey: queryKeys.entityRelations(entityName, entityId, relationName),
    queryFn: () => fetchEntityRelations(apiFetch, relationHref!),
    enabled: !!relationHref,
  });
}

// Re-export for convenience
export { HalSlice };
