import { useQuery } from "@tanstack/react-query";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHal } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfile } from "./use-profile";

export interface EntityDetailResult {
  data: Record<string, unknown>;
  selfHref: string;
  links: Record<string, unknown>;
  /** ETag from the GET response — will be used for If-Match in HZN-5B.1. */
  etag: string | null;
  /**
   * The set of HAL-FORMS template keys present on this item (e.g. "default",
   * "delete", "set-supplier", "add-tags"). Under ABAC the platform omits
   * templates the current user is not allowed to use — absence of a key means
   * the corresponding operation is denied.
   *
   * Hook point for HZN-7.4: UI affordances (Edit, Delete, relation link/unlink)
   * gate on membership in this set.
   */
  availableTemplates: ReadonlySet<string>;
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

  const rawTemplates = (object.data._templates as Record<string, unknown> | undefined) ?? {};
  const availableTemplates: ReadonlySet<string> = new Set(Object.keys(rawTemplates));

  return {
    data: { ...object.data },
    selfHref: selfLink?.href ?? "",
    links: (object.data._links as Record<string, unknown>) ?? {},
    etag,
    availableTemplates,
  };
}

export function useEntityDetail(entityName: string, entityId: string) {
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfile();
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
