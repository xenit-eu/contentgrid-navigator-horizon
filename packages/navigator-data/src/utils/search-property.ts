/**
 * Utilities for interpreting HAL-Forms search property field names.
 *
 * The platform encodes the search operator in the field name using a "~" separator
 * (e.g. "name~prefix", "company.name~prefix-match"). All string-level checks on
 * that naming convention live here so no other module needs to know the convention.
 */

/** True when the raw HAL field name indicates a prefix-match search operator. */
export function isPrefixSearchable(name: string): boolean {
  return name.endsWith("~prefix") || name.endsWith("~prefix-match");
}

/** True when the field traverses a relation path (e.g. "company.name~prefix"). */
export function isRelationSearchField(name: string): boolean {
  return name.includes(".");
}

/** True when the field uses a date-range operator (e.g. "date~before", "date~after"). */
export function isDateOperatorField(name: string): boolean {
  return name.endsWith("~before") || name.endsWith("~after");
}

/** Strips the operator suffix, returning just the field path (e.g. "company.name~prefix" → "company.name"). */
export function getBaseFieldName(name: string): string {
  return name.split("~")[0];
}

/** Returns the leaf segment of a relation path (e.g. "company.name" → "name", "name" → "name"). */
export function getValueField(name: string): string {
  return name.includes(".") ? name.split(".").pop()! : name;
}

/** Human-readable label: strips the operator suffix and converts dots to spaces. */
export function searchPropertyLabel(name: string): string {
  return getBaseFieldName(name).replace(".", " ");
}
