import { useQuery } from "@tanstack/react-query";
import ProfileAccessor from "../accessors/profile-accessor";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityProfileShape } from "../shapes";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

async function fetchEntityProfile(
  apiFetch: Parameters<typeof fetchHal>[0],
  profileUrl: string,
  entityName: string,
): Promise<ProfileAccessor | null> {
  // First fetch the profile root to get the entity link
  const { object: profileRoot } = await fetchHal<Record<string, unknown>>(apiFetch, profileUrl);
  const entityLinks = profileRoot.links.findLinks(cgRels.entity);

  // Find the entity link by name or href
  const entityLink = entityLinks.find((link) => {
    const name = link.name ?? link.href.split("/").pop() ?? "";
    return name === entityName || link.href.split("/").pop() === entityName;
  });

  if (!entityLink) {
    return null;
  }

  // Fetch the individual entity profile
  const { object: profileObject } = await fetchHal<EntityProfileShape>(apiFetch, entityLink.href);

  // Return ProfileAccessor wrapping the profile
  return new ProfileAccessor(entityLink, profileObject);
}

export function useEntityProfile(entityName: string) {
  const { apiFetch, profileUrl } = useNavigatorData();

  return useQuery({
    queryKey: queryKeys.entityProfile(entityName),
    queryFn: () => fetchEntityProfile(apiFetch, profileUrl, entityName),
    staleTime: Infinity,
    enabled: !!entityName,
  });
}
