import { useQuery } from "@tanstack/react-query";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { HalObjectWithTemplateShape } from "@contentgrid/hal-forms/shape";
import { ianaRelations } from "@contentgrid/hal/rels";
import { cgRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfile } from "./use-profile";

/** A parsed HAL-FORMS template extracted from an entity-item `_templates` entry. */
export interface ItemTemplate {
  /** HTTP method from the template (e.g. "PATCH", "DELETE", "PUT"). */
  method: string;
  /** Target URL from the template, or null when absent (fall back to self href). */
  target: string | null;
  /** Content-Type from the template, or null when absent. */
  contentType: string | null;
}

export interface EntityDetailResult {
  data: Record<string, unknown>;
  selfHref: string;
  links: Record<string, unknown>;
  /** ETag from the GET response — sent as If-Match on mutations. */
  etag: string | null;
  /**
   * Parsed `_templates` from the item response.
   * Keys match HAL-FORMS template names: "default" (update), "delete",
   * "set-<relation>" (to-one), "add-<relation>" (to-many), "clear-<relation>".
   */
  templates: Record<string, ItemTemplate>;
  /** True when the item carries a "default" template (update is available). */
  canUpdate: boolean;
  /** True when the item carries a "delete" template (delete is available). */
  canDelete: boolean;
  /**
   * Parsed `cg:content` links keyed by attribute name.
   * Use this to get the upload URL for a content attribute.
   */
  contentLinks: Record<string, string>;
  /**
   * Parsed `cg:relation` links keyed by relation name.
   * Use this to get the relation URL for linking/unlinking.
   */
  relationLinks: Record<string, string>;
}

/**
 * Returns the relation-mutation template for a given relation name.
 * Checks "set-<relation>" first (to-one), then "add-<relation>" (to-many).
 * Returns null when neither template is present.
 */
export function getRelationTemplate(
  result: EntityDetailResult,
  relationName: string,
): ItemTemplate | null {
  return result.templates[`set-${relationName}`] ?? result.templates[`add-${relationName}`] ?? null;
}

/**
 * Resolves all HAL-FORMS templates from a fetched entity item using `resolveTemplate`
 * from `@contentgrid/hal-forms`. Each template's method and content-type are read from
 * the library's resolved representation. The explicit `target` from the raw template
 * shape is preserved as-is (null when absent) so that downstream mutation hooks can
 * correctly fall back to HAL link hrefs for relation operations that have no target.
 */
function resolveTemplates(
  data: HalObjectWithTemplateShape<object, string, unknown, unknown>,
): Record<string, ItemTemplate> {
  const rawTemplates = (data as Record<string, unknown>)._templates;
  if (!rawTemplates || typeof rawTemplates !== "object") return {};
  const raw = rawTemplates as Record<string, Record<string, unknown>>;
  const result: Record<string, ItemTemplate> = {};
  for (const key of Object.keys(raw)) {
    const tpl = resolveTemplate(data, key);
    if (!tpl) continue;
    result[key] = {
      method: tpl.request.method,
      target: typeof raw[key]?.target === "string" ? raw[key].target : null,
      contentType: tpl.contentType ?? null,
    };
  }
  return result;
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
  const templates = resolveTemplates(object.data);

  // Build a map of content attribute name → upload URL from cg:content links.
  const contentLinks: Record<string, string> = {};
  for (const link of object.links.findLinks(cgRels.content)) {
    if (link.name) {
      contentLinks[link.name] = link.href;
    }
  }

  // Build a map of relation name → relation URL from cg:relation links.
  const relationLinks: Record<string, string> = {};
  for (const link of object.links.findLinks(cgRels.relation)) {
    if (link.name) {
      relationLinks[link.name] = link.href;
    }
  }

  return {
    data: { ...object.data },
    selfHref: selfLink?.href ?? "",
    links: (object.data._links as Record<string, unknown>) ?? {},
    etag,
    templates,
    canUpdate: "default" in templates,
    canDelete: "delete" in templates,
    contentLinks,
    relationLinks,
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
