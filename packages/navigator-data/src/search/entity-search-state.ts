/**
 * Generic URL search state for entity routes — a string-only key/value bag.
 * Filter values ride this bag as individual `s.<property>` keys (see
 * `@contentgrid/features/search`'s `decodeFiltersFromSearchState` /
 * `applyFiltersToSearchState`) so a saved search stays readable and shareable
 * in the URL. This type itself stays app/feature-agnostic — a plain string
 * bag — so it isn't tied to that one convention.
 */
export type EntitySearchState = Record<string, string | undefined>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  const result: EntitySearchState = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
