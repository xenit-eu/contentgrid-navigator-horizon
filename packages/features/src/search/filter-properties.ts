import type {
  HalFormValues,
  SearchHalFormTemplate,
  SearchHalFormTemplateProperty,
  SearchRequestSpec,
} from "@contentgrid/navigator-data";
import type {
  DirectionLabel,
  FilterInputKind,
  SearchFilterProperty,
  SearchOperator,
} from "@contentgrid/ui";

/**
 * Converts a search template's properties into pre-computed view models for FilterSidebar
 * (`SearchFilterProperty`, defined in `@contentgrid/ui`). All HAL naming conventions (~prefix,
 * ~gte, ~from, etc.) and type mapping are resolved here so the UI layer has no knowledge of HAL
 * search property name conventions.
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

  // Non-null assertion below is safe: the loop above sets an entry for every sp.groupKey
  // unconditionally, before this map() runs over the same `sps` array.
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
    // Safe for the same reason: the loop above adds every prop.groupKey (each prop pushes
    // into its own group's array or seeds a new one), before this filter() runs over the
    // same `properties` array.
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
 * or — for a datetime/datetime-local attribute only — a range/direction variant (e.g.
 * "invoice_date" alongside "invoice_date~after" / "~before"). Suppress it — one broad "exact
 * value" control adds nothing once a narrower or range-based way to search the same field is
 * already shown.
 *
 * The prefix/full-text half applies uniformly across kinds (select/boolean never have such
 * siblings in practice, since prefix/full-text operators only apply to string attributes). The
 * range/direction half is intentionally narrower — mirrors the legacy Navigator's
 * RangedJsfFormConvertor.createJsonProperty (contentgrid-navigator's
 * src/components/form/jsonforms.ts:354-357), which only drops the lone base property when it is
 * datetime/datetime-local. A numeric attribute (e.g. "amount" alongside "amount~gte"/"~lte")
 * keeps its bare exact-match filter alongside the range inputs — dropping it there would be a
 * user-facing behavior change beyond what the legacy app did.
 *
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
        (!!p.directionLabel && (prop.inputKind === "date" || prop.inputKind === "datetime"))),
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
 * string via `coerceFilterValue` based on the matching property's propertyType. Filters that
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
 * Inverse of `applyFilterValues`: given a resolved collection URL (e.g. `EntityItemCollection`'s
 * `selfHref`/`nextHref`, or `profileEntity.searchEntityRequest(values).url`), reads back the
 * filter values it encodes. Only query params whose name matches a known `filterProperties`
 * entry are picked up — `_cursor`, `_sort`, `_size`, and relation-scoping `_internal_*` params
 * never appear in `filterProperties` (see `buildFilterProperties`'s hidden-property exclusion),
 * so they're never mistaken for a user-facing filter.
 */
export function extractFilterValuesFromCollectionUrl(
  filterProperties: readonly SearchFilterProperty[],
  collectionUrl: string,
): Record<string, string> {
  let params: URLSearchParams;
  try {
    // A placeholder base lets URL parse a relative collectionUrl — only the query string is read.
    params = new URL(collectionUrl, "https://placeholder").searchParams;
  } catch {
    return {};
  }

  const knownNames = new Set(filterProperties.map((p) => p.name));
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (knownNames.has(key)) result[key] = value;
  }
  return result;
}

/**
 * Names of filter keys whose current raw value fails to coerce for the matching property's
 * propertyType (e.g. non-numeric text typed into a number field). `applyFilterValues` silently
 * omits exactly these same keys from the encoded request — this is its read-only companion, so
 * a caller (FilterSidebar, via `invalidFilterKeys`) can surface a visible error instead of the
 * request just quietly not filtering by that field.
 */
export function findInvalidFilterKeys(
  filterProperties: readonly SearchFilterProperty[],
  filters: Record<string, string>,
): string[] {
  const propertyTypeByName = new Map(filterProperties.map((p) => [p.name, p.propertyType]));
  return Object.entries(filters)
    .filter(([key, rawValue]) => {
      if (!rawValue) return false;
      return coerceFilterValue(propertyTypeByName.get(key) ?? "text", rawValue) === undefined;
    })
    .map(([key]) => key);
}

/**
 * Every `ProfileAttributeSearchType` (navigator-data) member is defined to equal a
 * `SearchOperator` (@contentgrid/ui) literal (see attribute-profile.ts) — the two are the same
 * set of runtime strings under two different type names, one nominal (the domain enum) and one
 * structural (the UI's plain string union). This is the known-good set, checked at runtime
 * rather than assumed, so a value outside it (e.g. `sp.searchType` falling through
 * `resolveSearchType`'s own unchecked cast in search-form.ts for a search-param `type` the
 * server reports that isn't one of the seven known values) doesn't silently pass through as a
 * bogus `SearchOperator` — see `computeSearchOperator`'s fallback below.
 */
const KNOWN_SEARCH_OPERATORS: ReadonlySet<SearchOperator> = new Set<SearchOperator>([
  "exact-match",
  "prefix-match",
  "full-text",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
]);

/**
 * Compute the SearchOperator for a property. `sp.searchType` is resolved in SearchHalFormTemplate
 * from the attribute's `blueprint:search-param` embeds (falling back to suffix parsing only when
 * unresolved), so range-pair operators (~from, ~until) already come through correctly here —
 * no name inspection needed.
 *
 * Falls back to "exact-match" for any value outside the known set — the same fallback the old
 * switch-based mapping's `default` case provided — so an unrecognized search type still gets
 * treated as an (redundancy-suppressible) exact-match property instead of silently rendering an
 * extra, unlabeled filter control alongside its real sibling.
 */
function computeSearchOperator(sp: SearchHalFormTemplateProperty): SearchOperator {
  const searchType = sp.searchType as SearchOperator;
  return KNOWN_SEARCH_OPERATORS.has(searchType) ? searchType : "exact-match";
}

function computeDirectionLabel(op: SearchOperator): DirectionLabel | undefined {
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
 * Keyed off the property's own wire type via `inputKind` (not the operator suffix): every
 * operator variant of one attribute (~after, ~before, ~from, ~until, …) shares that attribute's
 * single declared wire type in the search template — the suffix only changes the comparison,
 * never the type — so whichever operator fires, the encoding for that attribute is the same.
 *
 * Not verified against a live "date"-typed example: the committed profile dump has no
 * attribute of wire type "date" at all (every date-like attribute there is "datetime", using
 * `~after`/`~before`). This branch and its "date" inputKind are exercised by unit tests with a
 * hand-built fixture, not by anything traceable to a real backend response.
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
