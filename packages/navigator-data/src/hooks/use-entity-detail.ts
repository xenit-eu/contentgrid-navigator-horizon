import { useQuery } from "@tanstack/react-query";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHal } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfileEntities } from "./use-profile-entity";

export interface EntityDetailResult {
  data: Record<string, unknown>;
  selfHref: string;
  links: Record<string, unknown>;
  /** ETag from the GET response — will be used for If-Match in HZN-5B.1. */
  etag: string | null;
}

async function fetchEntityDetail(
  apiFetch: Parameters<typeof fetchHal>[0],
  collectionHref: string,
  entityId: string,
): Promise<EntityDetailResult> {
  const { object, etag } = await fetchHal<Record<string, unknown>>(
    apiFetch,
    `${collectionHref}/${entityId}`,
  );

  const selfLink = object.links.findLink(ianaRelations.self);

  return {
    data: { ...object.data },
    selfHref: selfLink?.href ?? "",
    links: (object.data._links as Record<string, unknown>) ?? {},
    etag,
  };
}

export function useEntityDetail(entityName: string, entityId: string) {
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfileEntities();
  const entity = entities?.find(
    (e) => e.name === entityName || e.href.split("/").pop() === entityName,
  );
  const collectionHref = entity?.collectionHref;

  return useQuery({
    queryKey: queryKeys.entityDetail(entityName, entityId),
    queryFn: () => fetchEntityDetail(apiFetch, collectionHref as string, entityId),
    enabled: !!entityName && !!entityId && !!collectionHref,
  });
}
