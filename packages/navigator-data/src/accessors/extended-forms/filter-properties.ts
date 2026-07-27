import type { HalFormValues } from "@contentgrid/hal-forms/values";
import type { SearchRequestSpec } from "../../api/requests";
import { ProfileAttributeSearchType } from "../attribute-profile";
import type { SearchHalFormTemplate, SearchHalFormTemplateProperty } from "./search-form";

export type FilterInputKind = "text" | "number" | "date" | "datetime" | "boolean" | "select";

export type SearchOperator =
  | "exact-match"
  | "prefix-match"
  | "full-text"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal";

/**
 * Pre-computed view model for a single filterable search property.
 * All display decisions (label, inputKind, directionLabel, dateEncoding) are resolved
 * in the data layer so FilterSidebar in packages/ui can render without any HAL knowledge.
 */
export interface SearchFilterProperty {
  /** HAL parameter name — used as the key when writing filter values */
  name: string;
  /** Fully resolved human-readable label; no name parsing needed in the UI */
  label: string;
  /** Optional description sourced from the profile attribute or relation */
  description?: string;
  /** Pre-computed input kind — no type/suffix cross-referencing in the UI */
  inputKind: FilterInputKind;
  /** The operator this parameter represents */
  searchOperator: SearchOperator;
  /**
   * Groups range-pair properties (e.g. date.~from + date.~until) under one heading.
   * Properties with the same groupKey render together.
   */
  groupKey: string;
  /**
   * Direction sub-label for range fields.
   * "After" / "Before" for strict (gt / lt); "From" / "Until" for inclusive (gte / lte).
   * Undefined for non-directional fields.
   */
  directionLabel?: "After" | "Before" | "From" | "Until";
  /**
   * For date/datetime inputs: how to encode the value from the input element.
   * "iso"   → append the time suffix (legacy ~greater-than style operators)
   * "plain" → pass as-is         (range-pair .~from / .~until operators)
   * Omit for non-date/datetime inputs.
   */
  dateEncoding?: "iso" | "plain";
  /** For select inputs: the available option values */
  options?: string[];
  /**
   * Set when this property searches across a relation boundary.
   * Value is the relation name (e.g. "supplier").
   * The feature layer uses this to wire typeahead to the related entity's collection.
   */
  relationKey?: string;
  /** Description of the relation being traversed, when isOverRelation is true. */
  relationDescription?: string;
}

/**
 * Converts a search template's properties into pre-computed view models for FilterSidebar.
 * All HAL naming conventions (~prefix, ~gte, .~from, etc.) and type mapping are resolved here
 * so the UI layer has no knowledge of HAL search property name conventions.
 *
 * Properties with the "hidden" wire type are excluded — they carry a fixed/internal value
 * (e.g. relation-scoping params injected via withHiddenParams) and were never meant to be a
 * user-facing filter control.
 */
export function buildFilterProperties(
  searchTemplate: SearchHalFormTemplate,
): SearchFilterProperty[] {
  return searchTemplate.searchProperties
    .filter((sp) => sp.property.type !== "hidden")
    .map(buildFilterProperty);
}

function buildFilterProperty(sp: SearchHalFormTemplateProperty): SearchFilterProperty {
  const name = sp.property.name;
  const { groupKey } = sp;

  const label = sp.property.prompt ?? sp.profileAttribute?.title ?? formatFieldName(groupKey);

  // || undefined strips empty strings — a "" description is no description
  const description =
    (sp.profileAttribute?.description || undefined) ??
    (sp.profileRelation?.description || undefined);

  const inlineOptions = sp.property.options?.isInline()
    ? (sp.property.options.inline as string[])
    : undefined;

  const inputKind: FilterInputKind = inlineOptions?.length
    ? "select"
    : mapWireTypeToInputKind(sp.property.type);

  const searchOperator = computeSearchOperator(sp);
  const directionLabel = computeDirectionLabel(searchOperator);
  const dateEncoding: "iso" | "plain" | undefined =
    inputKind === "date" || inputKind === "datetime"
      ? name.includes(".~")
        ? "plain"
        : "iso"
      : undefined;

  return {
    name,
    label,
    ...(description ? { description } : {}),
    inputKind,
    searchOperator,
    groupKey,
    ...(directionLabel ? { directionLabel } : {}),
    ...(dateEncoding ? { dateEncoding } : {}),
    ...(inlineOptions?.length ? { options: inlineOptions } : {}),
    ...(sp.isOverRelation && sp.profileRelation ? { relationKey: sp.profileRelation.name } : {}),
    ...(sp.isOverRelation && sp.profileRelation?.description
      ? { relationDescription: sp.profileRelation.description }
      : {}),
  };
}

/**
 * Maps a search property's raw HAL-FORMS wire type (`HalFormsPropertyType` from
 * @contentgrid/hal-forms — e.g. "checkbox", "date", "datetime-local", "number") to a
 * FilterInputKind. This is the type the server actually declares on the template property,
 * so it's read directly rather than cross-referenced via the entity's blueprint attribute
 * (which may not resolve at all for some relation-traversal search params).
 */
function mapWireTypeToInputKind(propertyType: string): FilterInputKind {
  switch (propertyType) {
    case "checkbox":
      return "boolean";
    case "datetime":
    case "datetime-local":
      return "datetime";
    case "date":
      return "date";
    case "number":
    case "range":
      return "number";
    default:
      return "text";
  }
}

/**
 * Coerces a raw FilterSidebar string value into the JS type the HAL-FORMS codec requires for
 * the given input kind (`DefinedHalFormValue["value"]` in @contentgrid/hal-forms/values):
 * `number`/`range` require a real `number`, `checkbox` requires a real `boolean`, and
 * `datetime`/`datetime-local` require a real `Date` — passing a string for any of these
 * throws `HalFormValueTypeError`, or for datetime, an unvalidated `new Date(...)` that only
 * fails later, deep inside the request encoder, as `RangeError: Invalid time value`.
 * Returns `undefined` when the value can't be safely coerced, so the caller can omit the
 * filter rather than send a request that would throw.
 */
export function coerceFilterValue(
  inputKind: FilterInputKind,
  rawValue: string,
): string | number | boolean | Date | undefined {
  switch (inputKind) {
    case "number": {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "boolean":
      if (rawValue === "true") return true;
      if (rawValue === "false") return false;
      return undefined;
    case "datetime": {
      const parsed = new Date(rawValue);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    default:
      return rawValue;
  }
}

/**
 * Applies a FilterSidebar `filters` map onto a HAL-FORMS values object, coercing each raw
 * string via `coerceFilterValue` based on the matching property's inputKind. Filters that
 * fail to coerce are silently omitted rather than sent.
 */
export function applyFilterValues(
  values: HalFormValues<SearchRequestSpec>,
  filterProperties: readonly SearchFilterProperty[],
  filters: Record<string, string>,
): HalFormValues<SearchRequestSpec> {
  const inputKindByName = new Map(filterProperties.map((p) => [p.name, p.inputKind]));
  return Object.entries(filters).reduce((vals, [key, rawValue]) => {
    if (!rawValue) return vals;
    const coerced = coerceFilterValue(inputKindByName.get(key) ?? "text", rawValue);
    return coerced === undefined ? vals : vals.withValue(key, coerced);
  }, values);
}

/**
 * Compute the SearchOperator for a property.
 * Range-pair operators (.~from, .~until) are not recognised by extractSearchType in
 * SearchHalFormTemplate (it falls through to exactMatch), so we check the property
 * name directly for those two cases.
 */
function computeSearchOperator(sp: SearchHalFormTemplateProperty): SearchOperator {
  const name = sp.property.name;
  if (name.includes(".~from")) return "greater-than-or-equal";
  if (name.includes(".~until")) return "less-than-or-equal";
  return mapSearchOperator(sp.searchType);
}

function mapSearchOperator(searchType: ProfileAttributeSearchType): SearchOperator {
  switch (searchType) {
    case ProfileAttributeSearchType.prefixMatch:
      return "prefix-match";
    case ProfileAttributeSearchType.fullText:
      return "full-text";
    case ProfileAttributeSearchType.greaterThan:
      return "greater-than";
    case ProfileAttributeSearchType.greaterThanOrEqual:
      return "greater-than-or-equal";
    case ProfileAttributeSearchType.lessThan:
      return "less-than";
    case ProfileAttributeSearchType.lessThanOrEqual:
      return "less-than-or-equal";
    case ProfileAttributeSearchType.exactMatch:
    default:
      return "exact-match";
  }
}

function computeDirectionLabel(
  op: SearchOperator,
): "After" | "Before" | "From" | "Until" | undefined {
  switch (op) {
    case "greater-than":
      return "After";
    case "greater-than-or-equal":
      return "From";
    case "less-than":
      return "Before";
    case "less-than-or-equal":
      return "Until";
    default:
      return undefined;
  }
}

function formatFieldName(name: string): string {
  return name
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
