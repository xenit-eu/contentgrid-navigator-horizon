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
 * (not a string replacement of "/profile/" → "/").
 *
 * The entities root (GET /) has cg:entity links whose href points directly at
 * the collection (e.g. /invoices) and whose name equals the singular entity name.
 * The profile root (GET /profile) has cg:entity links whose href points at the
 * HAL-FORMS profile (e.g. /profile/invoices).
 *
 * itemTemplateHref is built from collectionHref as "{collectionHref}/{id}".
 * This matches the describes.item templated link the server exposes on each
 * entity profile — deriving it here avoids N extra profile fetches at discovery
 * time while still using collectionHref from a real hypermedia link.
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

  return profileEntityLinks.map((link) => {
    // Use link.name when present; fall back to last path segment of the profile href
    const name = link.name ?? link.href.split("/").pop() ?? "";
    const title = titleCase(link.title ?? name);

    // Prefer collection href from root resource cg:entity link (matched by name).
    // Fall back to last-segment strip of the profile href only if the root resource
    // did not include a matching link (e.g. in test environments with partial fixtures).
    const collectionHref = collectionByName.get(name) ?? link.href.replace(/\/profile\//, "/");

    // RFC 6570 URI template for a single item, matching the server's describes.item link.
    const itemTemplateHref = `${collectionHref}/{id}`;

    return {
      name,
      title,
      href: link.href,
      collectionHref,
      itemTemplateHref,
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
