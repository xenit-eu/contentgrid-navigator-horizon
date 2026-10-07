import {
  type ProfileAttribute,
  ProfileAttributeSearchType,
  ProfileAttributeType,
  type ProfileEntity,
  type SearchHalFormTemplate,
  type SearchHalFormTemplateProperty,
  resolveRelationSearchTarget,
} from "@contentgrid/navigator-data";
import type { HalFormsField } from "../../hal-forms";
import type { SearchMode, SearchParamDescriptor, SearchValueKind } from "./types";

const MODE_BY_SEARCH_TYPE: Readonly<Record<ProfileAttributeSearchType, SearchMode>> = {
  [ProfileAttributeSearchType.exactMatch]: "exact",
  [ProfileAttributeSearchType.prefixMatch]: "prefix",
  [ProfileAttributeSearchType.fullText]: "full-text",
  [ProfileAttributeSearchType.greaterThan]: "gt",
  [ProfileAttributeSearchType.greaterThanOrEqual]: "gte",
  [ProfileAttributeSearchType.lessThan]: "lt",
  [ProfileAttributeSearchType.lessThanOrEqual]: "lte",
};

/**
 * Normalises the entity's search form into one `SearchParamDescriptor` per field
 * (data-model.md §2). `fields` must come from `resolveHalFormsFields(searchTemplate)`, so the
 * search bar offers exactly the parameters the advanced filter dialog offers (same redundancy
 * rules, hidden properties excluded). `profiles` resolves relation parameters to their target
 * attribute; while a target profile is not loaded yet, its parameters fall back to the raw
 * attribute name and, for numbers, to `decimal`.
 */
export function buildSearchParamDescriptors(
  fields: readonly HalFormsField[],
  searchTemplate: SearchHalFormTemplate,
  profiles: readonly ProfileEntity[],
): SearchParamDescriptor[] {
  const descriptors: SearchParamDescriptor[] = [];
  for (const field of fields) {
    const searchProperty = searchTemplate.getSearchPropertyByName(field.name);
    if (!searchProperty) continue;
    const descriptor = toDescriptor(field, searchProperty, profiles);
    if (descriptor) descriptors.push(descriptor);
  }
  return descriptors;
}

function toDescriptor(
  field: HalFormsField,
  searchProperty: SearchHalFormTemplateProperty,
  profiles: readonly ProfileEntity[],
): SearchParamDescriptor | undefined {
  const relation = searchProperty.isOverRelation ? searchProperty.profileRelation : undefined;
  const attribute = relation
    ? resolveRelationSearchTarget(searchProperty, profiles)?.targetAttribute
    : searchProperty.profileAttribute;

  const valueKind = valueKindOf(field, attribute);
  if (!valueKind) return undefined;

  return {
    name: field.name,
    groupKey: searchProperty.groupKey,
    attributeLabel: attribute?.title ?? searchProperty.groupKey.split(".").pop()!,
    label: field.label,
    valueKind,
    mode:
      valueKind === "allowed-values"
        ? "allowed-values"
        : MODE_BY_SEARCH_TYPE[searchProperty.searchType],
    relation: relation ? { name: relation.name, title: relation.title } : undefined,
    auditRole: relation ? undefined : auditRoleOf(searchProperty.profileAttribute),
    options: field.kind === "enum" ? field.options : undefined,
    field,
  };
}

/** `undefined` for a field kind that never appears on a search form (file, relation). */
function valueKindOf(
  field: HalFormsField,
  attribute: ProfileAttribute | undefined,
): SearchValueKind | undefined {
  switch (field.kind) {
    case "text":
    case "autocomplete":
      return "text";
    case "enum":
      return "allowed-values";
    case "boolean":
      return "boolean";
    case "datetime":
      return field.includesTime ? "datetime" : "date";
    case "number":
      return attribute?.type === ProfileAttributeType.long ? "integer" : "decimal";
    case "file":
    case "relation":
      return undefined;
  }
}

function auditRoleOf(attribute: ProfileAttribute | undefined): "created" | "modified" | undefined {
  if (attribute?.isCreatedDate) return "created";
  if (attribute?.isModifiedDate) return "modified";
  return undefined;
}
