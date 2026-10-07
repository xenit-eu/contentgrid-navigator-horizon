import {
  type FieldValue,
  type FieldValueMap,
  type HalFormValues,
  type SearchHalFormTemplate,
  type SearchRequestSpec,
  createValues,
} from "@contentgrid/navigator-data";
import type { HalFormsField } from "../hal-forms";
import { applyFilterValues, coerceFilterValue } from "./filter-properties";

/**
 * The two directions of the bridge between the collection's caller-facing `filters`
 * (`Record<string, string>`, URL-state-backed per `filter-url-state.ts`) and the typed
 * `FieldValue`s `HalFormsContainer` works with. Shared by the collection view's filter dialog and
 * the entity search bar so both surfaces convert filter values the same way.
 */

/** Empty-state default per `HalFormsField.kind`, mirroring `entity-item-create`'s
 * `defaultValueFor` — used only when a filter is entirely absent, never for a present-but-empty
 * one (there is no such state: an empty raw value is normalized away before it reaches
 * `filters`). */
export function emptyValueFor(field: HalFormsField): FieldValue {
  if (field.kind === "boolean" || field.kind === "file") return undefined;
  if ((field.kind === "enum" || field.kind === "autocomplete") && field.multiValue) return [];
  return "";
}

/** String `filters` -> typed `FieldValue`s for `HalFormsContainer`'s `values` prop, reusing
 * `coerceFilterValue` (keyed off the raw wire type every `HalFormsField.property` still carries)
 * for a present, non-empty raw value. */
export function filterFieldValues(
  fields: readonly HalFormsField[],
  filters: Readonly<Record<string, string>>,
): FieldValueMap {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw = filters[field.name];
    values[field.name] = raw ? coerceFilterValue(field.property.type, raw) : emptyValueFor(field);
  }
  return values;
}

/** Inverse of `filterFieldValues`, for `HalFormsContainer`'s `onChange`. */
export function encodeFilterValue(value: FieldValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  if (typeof value === "string") return value === "" ? undefined : value;
  return String(value);
}

/**
 * The search values the collection is fetched with: the search template's own values with
 * `filters` applied, plus `_sort` when a sort is active. `_sort` is always multi-value — a
 * single-element array, never a plain string.
 */
export function buildCollectionSearchValues(
  searchTemplate: SearchHalFormTemplate,
  fields: readonly HalFormsField[],
  filters: Readonly<Record<string, string>>,
  currentSort?: string,
): HalFormValues<SearchRequestSpec> {
  const filtered = applyFilterValues(createValues(searchTemplate.template), fields, filters);
  return currentSort && searchTemplate.sortProperty
    ? filtered.withValue(searchTemplate.sortProperty.name, [currentSort])
    : filtered;
}
