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
  /**
   * The raw HAL-FORMS wire type (`sp.property.type`, e.g. "number", "checkbox"), carried
   * through separately from `inputKind` because `inputKind` collapses to "select" whenever
   * inline options are present — losing the underlying type `coerceFilterValue` needs to
   * encode the value correctly (see `coerceFilterValue`'s doc comment).
   */
  propertyType: string;
  /** The operator this parameter represents */
  searchOperator: SearchOperator;
  /**
   * Groups range-pair properties (e.g. date~from + date~until) under one heading.
   * Properties with the same groupKey render together.
   */
  groupKey: string;
  /**
   * Heading for the group this property belongs to. Identical for every property sharing a
   * groupKey — derived from the shared attribute (`profileAttribute.title`, falling back to a
   * formatted groupKey), NOT from any one sibling's own `label` — a sibling's `label` can carry
   * operator wording from its own prompt (e.g. "Total amount: Greater than") and, for a
   * suppressed exact-match sibling, may not even survive into the final list.
   */
  groupLabel: string;
  /**
   * Direction sub-label for range fields.
   * "After" / "Before" for strict (gt / lt); "From" / "Until" for inclusive (gte / lte).
   * Undefined for non-directional fields.
   */
  directionLabel?: "After" | "Before" | "From" | "Until";
  /**
   * For date/datetime inputs: how to encode the value from the input element.
   * "iso"   → append the time component ("datetime"/"datetime-local" wire type)
   * "plain" → pass as-is, a bare yyyy-MM-dd string ("date" wire type)
   * Keyed off the property's own wire type, not the operator suffix — every operator
   * (~after, ~from, ~gte, …) on a "date"-typed attribute uses the same bare-date encoding.
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
 * All HAL naming conventions (~prefix, ~gte, ~from, etc.) and type mapping are resolved here
 * so the UI layer has no knowledge of HAL search property name conventions.
 *
 * Properties with the "hidden" wire type are excluded — they carry a fixed/internal value
 * (e.g. relation-scoping params injected via withHiddenParams) and were never meant to be a
 * user-facing filter control.
 *
 * Which of the backend's search params are actually offered is model semantics, so it's
 * decided here rather than in FilterSidebar: a redundant exact-match or strict-range-bound
 * sibling (see `isRedundantExactMatch` / `isRedundantStrictRangeBound`) is dropped from the
 * result entirely, keeping FilterSidebar a pure renderer of whatever list it's given.
 */
export function buildFilterProperties(
  searchTemplate: SearchHalFormTemplate,
): SearchFilterProperty[] {
  const sps = searchTemplate.searchProperties.filter((sp) => sp.property.type !== "hidden");

  // One groupLabel per groupKey, computed from the shared attribute — independent of which
  // sibling ends up first in the array, and independent of which siblings get suppressed below.
  const groupLabelByGroupKey = new Map<string, string>();
  for (const sp of sps) {
    if (!groupLabelByGroupKey.has(sp.groupKey)) {
      groupLabelByGroupKey.set(
        sp.groupKey,
        sp.profileAttribute?.title ?? formatFieldName(sp.groupKey),
      );
    }
  }

  const properties = sps.map((sp) =>
    buildFilterProperty(sp, groupLabelByGroupKey.get(sp.groupKey)!),
  );

  const propertiesByGroupKey = new Map<string, SearchFilterProperty[]>();
  for (const prop of properties) {
    const siblings = propertiesByGroupKey.get(prop.groupKey);
    if (siblings) siblings.push(prop);
    else propertiesByGroupKey.set(prop.groupKey, [prop]);
  }

  return properties.filter((prop) => {
    const siblings = propertiesByGroupKey.get(prop.groupKey)!;
    return !isRedundantExactMatch(prop, siblings) && !isRedundantStrictRangeBound(prop, siblings);
  });
}

function buildFilterProperty(
  sp: SearchHalFormTemplateProperty,
  groupLabel: string,
): SearchFilterProperty {
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
  const dateEncoding = computeDateEncoding(inputKind);

  return {
    name,
    label,
    ...(description ? { description } : {}),
    inputKind,
    propertyType: sp.property.type,
    searchOperator,
    groupKey,
    groupLabel,
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
 * An exact-match property is redundant once a MORE SPECIFIC sibling exists for the same
 * attribute: a prefix-match or full-text variant (e.g. "number" alongside "number~prefix"),
 * or a range/direction variant (e.g. "invoice_date" alongside "invoice_date~after" /
 * "~before"). Suppress it — one broad "exact value" control adds nothing once a narrower or
 * range-based way to search the same field is already shown. Applies uniformly across kinds
 * (text, date, datetime, number); select/boolean never have such siblings in practice, since
 * prefix/full-text/range operators only apply to string or ordered-value attributes.
 * Suppresses every redundant sibling, not just one — some search templates expose more than
 * one exact-match-shaped param for the same attribute (see the "range-pair operators" tests).
 */
function isRedundantExactMatch(
  prop: SearchFilterProperty,
  siblings: readonly SearchFilterProperty[],
): boolean {
  if (prop.searchOperator !== "exact-match") return false;
  return siblings.some(
    (p) =>
      p.groupKey === prop.groupKey &&
      (p.searchOperator === "prefix-match" ||
        p.searchOperator === "full-text" ||
        !!p.directionLabel),
  );
}

/**
 * A strict range bound ("greater-than" / "less-than", i.e. the "After"/"Before" direction)
 * is redundant once an inclusive sibling covering the same bound direction exists for the
 * same attribute ("greater-than-or-equal" / "less-than-or-equal", i.e. "From"/"Until").
 * Mirrors the legacy Navigator's range-pairing behavior (RangedJsfFormConvertor / NestedRange
 * in contentgrid-navigator's src/components/form/jsonforms.ts): it prefers the inclusive
 * suffix pair when both are present for the same base field, and never renders the strict
 * pair alongside it. Without this, a search template that exposes all four comparison
 * operators for one attribute (e.g. price~gt/~gte/~lt/~lte) would render four stacked inputs
 * instead of the two (From/Until) that cover the same range.
 */
function isRedundantStrictRangeBound(
  prop: SearchFilterProperty,
  siblings: readonly SearchFilterProperty[],
): boolean {
  if (prop.searchOperator !== "greater-than" && prop.searchOperator !== "less-than") return false;
  const inclusiveEquivalent =
    prop.searchOperator === "greater-than" ? "greater-than-or-equal" : "less-than-or-equal";
  return siblings.some(
    (p) => p.groupKey === prop.groupKey && p.searchOperator === inclusiveEquivalent,
  );
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
 * the given property's wire type (`DefinedHalFormValue["value"]` in @contentgrid/hal-forms/values):
 * `number`/`range` require a real `number`, `checkbox` requires a real `boolean`, and
 * `datetime`/`datetime-local` require a real `Date` — passing a string for any of these
 * throws `HalFormValueTypeError`, or for datetime, an unvalidated `new Date(...)` that only
 * fails later, deep inside the request encoder, as `RangeError: Invalid time value`.
 * Returns `undefined` when the value can't be safely coerced, so the caller can omit the
 * filter rather than send a request that would throw.
 *
 * Switches on the wire type (`propertyType`), not `inputKind`: `inputKind` collapses to
 * "select" whenever a property carries inline options, which happens for `allowed-values`
 * constraints on ANY attribute type — a number- or checkbox-typed attribute with an
 * allowed-values constraint would otherwise reach `default:` here, return a raw string, and
 * throw `HalFormValueTypeError` in the codec, the same failure mode this function exists to
 * prevent.
 */
export function coerceFilterValue(
  propertyType: string,
  rawValue: string,
): string | number | boolean | Date | undefined {
  switch (propertyType) {
    case "number":
    case "range": {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "checkbox":
      if (rawValue === "true") return true;
      if (rawValue === "false") return false;
      return undefined;
    case "datetime":
    case "datetime-local": {
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
  const propertyTypeByName = new Map(filterProperties.map((p) => [p.name, p.propertyType]));
  return Object.entries(filters).reduce((vals, [key, rawValue]) => {
    if (!rawValue) return vals;
    const coerced = coerceFilterValue(propertyTypeByName.get(key) ?? "text", rawValue);
    return coerced === undefined ? vals : vals.withValue(key, coerced);
  }, values);
}

/**
 * Compute the SearchOperator for a property. `sp.searchType` is resolved in SearchHalFormTemplate
 * from the attribute's `blueprint:search-param` embeds (falling back to suffix parsing only when
 * unresolved), so range-pair operators (~from, ~until) already come through correctly here —
 * no name inspection needed.
 */
function computeSearchOperator(sp: SearchHalFormTemplateProperty): SearchOperator {
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

/**
 * "plain" for a "date"-typed property, which the UI encodes as a bare yyyy-MM-dd value with
 * no time component; "iso" for "datetime"/"datetime-local", which needs a full ISO timestamp.
 * Keyed off the property's own wire type via `inputKind` (not the operator suffix) — a
 * "date"-typed attribute uses the bare-date encoding for every operator that applies to it
 * (~after, ~before, ~from, ~until alike), confirmed against a live profile where all of them
 * carry `"type": "date"` on the same attribute.
 */
function computeDateEncoding(inputKind: FilterInputKind): "iso" | "plain" | undefined {
  if (inputKind === "date") return "plain";
  if (inputKind === "datetime") return "iso";
  return undefined;
}

function formatFieldName(name: string): string {
  return name
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
