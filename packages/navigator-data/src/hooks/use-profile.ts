import { useQuery } from "@tanstack/react-query";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityInfo } from "../types/entity";
import { titleCase } from "../utils/format";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

async function fetchProfile(
  apiFetch: Parameters<typeof fetchHal>[0],
  profileUrl: string,
): Promise<EntityInfo[]> {
  const { object } = await fetchHal<Record<string, unknown>>(apiFetch, profileUrl);
  const entityLinks = object.links.findLinks(cgRels.entity);

  return entityLinks.map((link) => {
    const name = link.name ?? link.href.split("/").pop() ?? "";
    return {
      name,
      title: titleCase(link.title ?? name),
      href: link.href,
      collectionHref: link.href.replace(/\/profile\//, "/"),
    };
  });
}

export function useProfile() {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile(apiFetch, profileUrl),
    staleTime: Infinity,
  });
}

export type { EntityInfo };
