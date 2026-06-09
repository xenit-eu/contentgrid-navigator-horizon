import { useQuery } from "@tanstack/react-query";
import { blueprintRels } from "../api/contentgrid-rels";
import { fetchHal } from "../api/hal-client";
import type {
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
    if (type === "object") {
      const subAttrs = halObj.embedded?.findEmbeddeds(blueprintRels.attribute) ?? [];
      const subNames = new Set(subAttrs.map((s) => (s.data as { name: string }).name));
      if (subNames.has("filename") && subNames.has("mimetype") && subNames.has("length")) {
        type = "content";
      } else if (subNames.has("created_by") && subNames.has("created_date")) {
        type = "audit_metadata";
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
