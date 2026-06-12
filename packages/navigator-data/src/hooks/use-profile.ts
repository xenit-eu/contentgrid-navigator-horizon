import { useQuery } from "@tanstack/react-query";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type { EntityInfo } from "../types/entity";
import { titleCase } from "../utils/format";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

/**
 * Fetches the profile root and the entities root in parallel, then joins them
 * so that collectionHref comes from a real cg:entity link on the root resource
 * (never a string transform of the profile href — affordance rule 3).
 *
 * The entities root (GET /) has cg:entity links whose href points directly at
 * the collection (e.g. /invoices) and whose name equals the singular entity name.
 * The profile root (GET /profile) has cg:entity links whose href points at the
 * HAL-FORMS profile (e.g. /profile/invoices).
 *
 * Entities whose collection link is absent from the root resource are skipped:
 * link absence means the collection is not accessible for this user
 * (affordance rule 2) — a collection URL is never derived for them.
 *
 * The per-item URL template is NOT exposed here; it comes from the entity
 * profile's _links.describes item link, surfaced as EntitySchema.itemTemplateHref
 * by useEntitySchema.
 */
async function fetchProfile(
  apiFetch: Parameters<typeof fetchHal>[0],
  profileUrl: string,
): Promise<EntityInfo[]> {
  // Derive root URL from profileUrl (e.g. https://api.example.com/profile → https://api.example.com/)
  const rootUrl = new URL("/", profileUrl).href;

  // Fetch profile root and entities root in parallel
  const [profileResult, rootResult] = await Promise.all([
    fetchHal<Record<string, unknown>>(apiFetch, profileUrl),
    fetchHal<Record<string, unknown>>(apiFetch, rootUrl),
  ]);

  const profileEntityLinks = profileResult.object.links.findLinks(cgRels.entity);
  const rootEntityLinks = rootResult.object.links.findLinks(cgRels.entity);

  // Build a map from entity name → collection href using the root resource's cg:entity links.
  // The root resource link name is the singular entity name, matching the profile root link name.
  const collectionByName = new Map<string, string>();
  for (const link of rootEntityLinks) {
    if (link.name) {
      collectionByName.set(link.name, link.href);
    }
  }

  return profileEntityLinks.flatMap((link) => {
    // Use link.name when present; fall back to last path segment of the profile href
    const name = link.name ?? link.href.split("/").pop() ?? "";

    // Collection href must come from the root resource cg:entity link (matched by
    // name). No matching link means the collection is not accessible — skip the
    // entity instead of deriving a URL (rules 2 and 3).
    const collectionHref = collectionByName.get(name);
    if (collectionHref === undefined) return [];

    return [
      {
        name,
        title: titleCase(link.title ?? name),
        href: link.href,
        collectionHref,
      },
    ];
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
