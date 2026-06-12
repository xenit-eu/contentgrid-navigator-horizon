import { useQuery } from "@tanstack/react-query";
import { blueprintRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type {
  AuditRoles,
  AuditSubAttributeRole,
  CreateFormRelation,
  EntityAttribute,
  EntityRelation,
  EntitySchema,
  SearchProperty,
  SortOption,
} from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfile } from "./use-profile";

interface RawAttribute {
  name: string;
  title?: string;
  type: string;
  description?: string;
  readOnly?: boolean;
  required?: boolean;
  constraints?: { required?: boolean; unique?: boolean };
  searchParams?: { "exact-match"?: boolean; "prefix-match"?: boolean };
}

interface RawRelation {
  name: string;
  title?: string;
  many_source_per_target: boolean;
  many_target_per_source: boolean;
}

/**
 * The four constraint types that the platform places on audit sub-attributes.
 * These are the canonical discriminators — prefer them over probing sub-attribute
 * names, which are implementation details that could differ across deployments.
 */
const AUDIT_CONSTRAINT_TYPES = new Set<string>([
  "created-date",
  "created-by",
  "modified-date",
  "modified-by",
]);

export async function fetchEntitySchema(
  apiFetch: Parameters<typeof fetchHal>[0],
  profileHref: string,
): Promise<EntitySchema> {
  const { object } = await fetchHal<Record<string, unknown>>(apiFetch, profileHref);

  const embeddedAttributes = object.embedded?.findEmbeddeds(blueprintRels.attribute) ?? [];
  const embeddedRelations = object.embedded?.findEmbeddeds(blueprintRels.relation) ?? [];

  const attributes: EntityAttribute[] = embeddedAttributes.map((halObj) => {
    const attr = halObj.data as unknown as RawAttribute;

    let type = attr.type;
    let auditRoles: AuditRoles | undefined;

    if (type === "object") {
      const subAttrs = halObj.embedded?.findEmbeddeds(blueprintRels.attribute) ?? [];

      // --- Primary: constraint-driven detection ---
      // Build the auditRoles map by scanning system-managed constraints on each
      // sub-attribute.  A sub-attribute carries an audit role when it has a
      // blueprint:constraint of type "created-date", "created-by",
      // "modified-date", or "modified-by".
      const discoveredRoles: AuditRoles = {};
      for (const subAttr of subAttrs) {
        const subName = (subAttr.data as { name: string }).name;
        const subConstraints = subAttr.embedded?.findEmbeddeds(blueprintRels.constraint) ?? [];
        for (const c of subConstraints) {
          const constraintType = (c.data as { type: string }).type;
          if (AUDIT_CONSTRAINT_TYPES.has(constraintType)) {
            discoveredRoles[constraintType as AuditSubAttributeRole] = subName;
          }
        }
      }

      if (Object.keys(discoveredRoles).length > 0) {
        // At least one audit constraint found — treat as audit_metadata.
        type = "audit_metadata";
        auditRoles = discoveredRoles;
      } else {
        // No system-managed constraints found; fall back to sub-attribute name
        // probing for backward compatibility with fixtures that predate constraint
        // annotations.  This path handles the legacy `content` object shape
        // (filename/mimetype/length) and legacy audit shapes (created_by/created_date).
        const subNames = new Set(subAttrs.map((s) => (s.data as { name: string }).name));
        if (subNames.has("filename") && subNames.has("mimetype") && subNames.has("length")) {
          // content attribute: platform exposes sub-attributes with these exact names.
          // The `cg:content` link on entity-items is the stronger signal, but this
          // profile-level check lets us classify without fetching entity data.
          type = "content";
        } else if (subNames.has("created_by") && subNames.has("created_date")) {
          // Fallback for profiles that carry audit sub-attributes but no system-managed
          // constraints (e.g. older API versions or fixtures not yet updated).
          type = "audit_metadata";
          // Best-effort role map from well-known default names.
          auditRoles = {
            "created-by": "created_by",
            "created-date": "created_date",
            ...(subNames.has("last_modified_by") ? { "modified-by": "last_modified_by" } : {}),
            ...(subNames.has("last_modified_date")
              ? { "modified-date": "last_modified_date" }
              : {}),
          };
        }
      }
    }

    const constraints = halObj.embedded?.findEmbeddeds(blueprintRels.constraint) ?? [];
    const allowedValuesConstraint = constraints.find(
      (c) => (c.data as { type: string }).type === "allowed-values",
    );
    const allowedValues = allowedValuesConstraint
      ? ((allowedValuesConstraint.data as { values?: string[] }).values ?? undefined)
      : undefined;

    return {
      name: attr.name,
      title: attr.title || attr.name,
      type,
      description: attr.description,
      readOnly: attr.readOnly ?? false,
      required: attr.constraints?.required ?? attr.required ?? false,
      unique: attr.constraints?.unique ?? false,
      searchable: attr.searchParams?.["exact-match"] ?? false,
      prefixSearchable: attr.searchParams?.["prefix-match"] ?? false,
      allowedValues,
      ...(auditRoles !== undefined ? { auditRoles } : {}),
    };
  });

  const relations: EntityRelation[] = embeddedRelations.map((halObj) => {
    const rel = halObj.data as unknown as RawRelation;
    const targetLink = halObj.links.findLink(blueprintRels.targetEntity);
    return {
      name: rel.name,
      title: rel.title || rel.name,
      manyToOne: rel.many_source_per_target && !rel.many_target_per_source,
      manyToMany: rel.many_source_per_target && rel.many_target_per_source,
      targetEntityHref: targetLink?.href,
    };
  });

  const templates = (object.data as Record<string, unknown>)._templates as
    | Record<
        string,
        {
          properties?: Array<{
            name: string;
            prompt?: string;
            type: string;
            required?: boolean;
            maxItems?: number;
            options?: {
              inline?: Array<string | { property: string }>;
              link?: { href: string };
            };
          }>;
        }
      >
    | undefined;

  const searchProps = templates?.search?.properties ?? [];
  const searchProperties: SearchProperty[] = searchProps
    .filter((p) => p.name !== "_sort")
    .map((p) => ({
      name: p.name,
      prompt: p.prompt,
      type: p.type,
      options:
        Array.isArray(p.options?.inline) && p.options?.inline.every((v) => typeof v === "string")
          ? { inline: p.options.inline }
          : undefined,
    }));

  const sortProp = searchProps.find((p) => p.name === "_sort");
  const sortInline = sortProp?.options?.inline ?? [];
  const sortOptions: SortOption[] = sortInline
    .map((opt): SortOption | null => {
      if (typeof opt === "string") {
        const property = opt.split(",")[0];
        return property ? { value: opt, property, prompt: opt } : null;
      }
      const o = opt as { value?: string; property?: string; prompt?: string };
      if (!o.value || !o.property) return null;
      return { value: o.value, property: o.property, prompt: o.prompt ?? o.value };
    })
    .filter((o): o is SortOption => o !== null);

  const sortableFields = [...new Set(sortOptions.map((o) => o.property))];

  const createFormProps = templates?.["create-form"]?.properties ?? [];
  const createFormRelations: CreateFormRelation[] = createFormProps
    .filter((p) => p.type === "url" && p.options?.link?.href)
    .map((p) => {
      const linkHref = p.options!.link!.href;
      const targetEntityName = linkHref.split("/").at(-1) || p.name;
      const schemaRelation = relations.find((r) => r.name === p.name);
      return {
        name: p.name,
        title: schemaRelation?.title ?? p.prompt ?? p.name,
        targetEntityName,
        required: p.required ?? false,
        manyToOne: p.maxItems === 1,
      };
    });

  const description = (object.data as Record<string, unknown>).description as string | undefined;

  return {
    description,
    attributes,
    relations,
    searchProperties,
    sortableFields,
    sortOptions,
    createFormRelations,
  };
}

export function useEntitySchema(entityName: string) {
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfile();
  const entity = entities?.find(
    (e) => e.name === entityName || e.href.split("/").pop() === entityName,
  );

  return useQuery({
    queryKey: queryKeys.entitySchema(entityName),
    queryFn: () => fetchEntitySchema(apiFetch, entity!.href),
    staleTime: Infinity,
    enabled: !!entityName && !!entity,
  });
}
