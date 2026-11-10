import type {
  HalFormValues,
  SearchHalFormTemplate,
  SearchRequestSpec,
} from "@contentgrid/navigator-data";
import type { HalFormsField } from "../hal-forms";

/**
 * Coerces a raw filter-form string value into the JS type the HAL-FORMS codec requires for
 * the given property's wire type (`DefinedHalFormValue["value"]` in @contentgrid/hal-forms/values):
 * `number`/`range` require a real `number`, `checkbox` requires a real `boolean`, and
 * `datetime`/`datetime-local` require a real `Date` — passing a string for any of these
 * throws `HalFormValueTypeError`, or for datetime, an unvalidated `new Date(...)` that only
 * fails later, deep inside the request encoder, as `RangeError: Invalid time value`.
 * Returns `undefined` when the value can't be safely coerced, so the caller can omit the
 * filter rather than send a request that would throw.
 *
 * Switches on the wire type (`propertyType`), not the field's `kind`: `kind` collapses to
 * "enum" whenever a property carries inline options, which happens for `allowed-values`
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
 * Applies a `filters` map onto a HAL-FORMS values object, coercing each raw string via
 * `coerceFilterValue` based on the matching field's wire type (`field.property.type`). Filters
 * that fail to coerce are silently omitted rather than sent.
 *
 * Keyed off `fields` (`HalFormsField[]`, from `resolveHalFormsFields`) rather than a separate
 * view-model list: `fields` is already the deduplicated, hidden-property-excluded set of
 * filters actually rendered, so this can never drift out of sync with what the form offers —
 * including the datetime exact-match field `resolveHalFormsFields` deliberately keeps alongside
 * its `~after`/`~before` range pair.
 */
export function applyFilterValues(
  values: HalFormValues<SearchRequestSpec>,
  fields: readonly HalFormsField[],
  filters: Record<string, string>,
): HalFormValues<SearchRequestSpec> {
  const propertyTypeByName = new Map(fields.map((f) => [f.name, f.property.type]));
  return Object.entries(filters).reduce((vals, [key, rawValue]) => {
    if (!rawValue) return vals;
    const coerced = coerceFilterValue(propertyTypeByName.get(key) ?? "text", rawValue);
    return coerced === undefined ? vals : vals.withValue(key, coerced);
  }, values);
}

/**
 * Inverse of `applyFilterValues`: given a resolved collection URL (e.g. `EntityItemCollection`'s
 * `selfHref`/`nextHref`, or `profileEntity.searchEntityRequest(values).url`), reads back the
 * filter values it encodes. Only query params whose name matches a known `fields` entry are
 * picked up — `_cursor`, `_sort`, `_size`, and relation-scoping `_internal_*` params never appear
 * there (`resolveHalFormsFields` excludes the `hidden` wire type), so they're never mistaken for
 * a user-facing filter.
 */
export function extractFilterValuesFromCollectionUrl(
  fields: readonly HalFormsField[],
  collectionUrl: string,
): Record<string, string> {
  let params: URLSearchParams;
  try {
    // A placeholder base lets URL parse a relative collectionUrl — only the query string is read.
    params = new URL(collectionUrl, "https://placeholder").searchParams;
  } catch {
    return {};
  }

  const knownNames = new Set(fields.map((f) => f.name));
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (knownNames.has(key)) result[key] = value;
  }
  return result;
}

/**
 * Attribute names the user is actively filtering/searching on right now, suitable for
 * force-including as visible table columns. Only DIRECT (non-relation-traversal) properties
 * qualify — a relation-traversal property's `groupKey` is `"relation.attribute"`, which doesn't
 * correspond to a column `buildColumns` (packages/features/src/preferences) can render on the
 * current entity, so any property with `isOverRelation` set is excluded here rather than left
 * for the caller to filter out.
 *
 * Looks each active filter key up directly against `searchTemplate.searchProperties` (via
 * `getSearchPropertyByName`) rather than a separate view-model list: `groupKey`/`isOverRelation`
 * aren't carried on `HalFormsField` itself (only its `autocomplete`-kind `searchContext` does),
 * so the raw search template is the only place left to resolve them from.
 *
 * De-duplicated via the returned `Set`-backed array: sibling properties sharing one `groupKey`
 * (e.g. a "From"/"Until" range pair) can both be active at once but should only force one column.
 */
export function findActivelyFilteredAttributeNames(
  searchTemplate: SearchHalFormTemplate,
  filters: Record<string, string>,
): string[] {
  return [
    ...new Set(
      Object.entries(filters)
        .filter(([, value]) => !!value)
        .map(([key]) => searchTemplate.getSearchPropertyByName(key))
        .filter((sp) => !!sp && !sp.isOverRelation)
        .map((sp) => sp!.groupKey),
    ),
  ];
}

/**
 * Names of filter keys whose current raw value fails to coerce for the matching field's wire
 * type (e.g. non-numeric text typed into a number field). `applyFilterValues` silently omits
 * exactly these same keys from the encoded request — this is its read-only companion, so a
 * caller can surface a visible error instead of the request just quietly not filtering by that
 * field.
 */
export function findInvalidFilterKeys(
  fields: readonly HalFormsField[],
  filters: Record<string, string>,
): string[] {
  const propertyTypeByName = new Map(fields.map((f) => [f.name, f.property.type]));
  return Object.entries(filters)
    .filter(([key, rawValue]) => {
      if (!rawValue) return false;
      return coerceFilterValue(propertyTypeByName.get(key) ?? "text", rawValue) === undefined;
    })
    .map(([key]) => key);
}
