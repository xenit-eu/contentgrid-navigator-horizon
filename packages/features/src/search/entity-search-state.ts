/**
 * Generic URL search state for entity routes — a string-only key/value bag,
 * used as the TanStack Router `validateSearch` for the entity list route.
 * Filter values ride this bag as individual `s.<property>` keys (see
 * `decodeFiltersFromSearchState` / `applyFiltersToSearchState` in
 * `filter-url-state.ts`) so a saved search stays readable and shareable in
 * the URL. This type itself stays tied to no one convention — a plain string
 * bag — so other URL-state fields can ride along without a new validator.
 */
export type EntitySearchState = Record<string, string | undefined>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  const result: EntitySearchState = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
