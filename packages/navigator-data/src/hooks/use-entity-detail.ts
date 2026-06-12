import { useQuery } from "@tanstack/react-query";
import { ianaRelations } from "@contentgrid/hal/rels";
import UriTemplate from "@contentgrid/uri-template";
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
}

async function fetchEntityDetail(
  apiFetch: Parameters<typeof fetchHal>[0],
  itemTemplateHref: string,
  entityId: string,
): Promise<EntityDetailResult> {
  // Expand the RFC 6570 item template from the entity profile's describes.item link.
  // This avoids constructing the URL via string concatenation.
  const itemUrl = new UriTemplate(itemTemplateHref).expand({ id: entityId });

  const { object, etag } = await fetchHal<Record<string, unknown>>(apiFetch, itemUrl);

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
  const { data: entities } = useProfile();
  // Match by link name (singular entity name from the profile root cg:entity link).
  // No longer falls back to last path segment of href — name is always present on
  // well-formed ContentGrid profile roots.
  const entity = entities?.find((e) => e.name === entityName);
  const itemTemplateHref = entity?.itemTemplateHref;

  return useQuery({
    queryKey: queryKeys.entityDetail(entityName, entityId),
    queryFn: () => fetchEntityDetail(apiFetch, itemTemplateHref as string, entityId),
    enabled: !!entityName && !!entityId && !!itemTemplateHref,
  });
}
