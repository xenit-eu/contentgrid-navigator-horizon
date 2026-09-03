import type { EntitySearchState } from "./entity-search-state";

/**
 * The URL search-state key that carries the active sort value (a single HAL-FORMS `_sort`
 * option token, e.g. "name,asc"). Rides as a plain sibling key in the same `EntitySearchState`
 * bag filters use — filters are namespaced under `s.*` (see `filter-url-state.ts`), so `sort`
 * can't collide with one.
 */
const SORT_KEY = "sort";

/**
 * Reads the active sort value back out of a route's URL search state. Returns `undefined` when
 * no sort is applied.
 */
export function decodeSortFromSearchState(search: EntitySearchState): string | undefined {
  return search[SORT_KEY];
}

/**
 * Replaces the `sort` slice of a route's URL search state, leaving every other key (including
 * all `s.*` filters) untouched. Passing `sort: undefined` removes the key entirely rather than
 * leaving a stale empty param behind.
 */
export function applySortToSearchState(
  prev: EntitySearchState,
  sort: string | undefined,
): EntitySearchState {
  const next: EntitySearchState = {};
  for (const [key, value] of Object.entries(prev)) {
    if (key !== SORT_KEY) next[key] = value;
  }
  if (sort !== undefined) next[SORT_KEY] = sort;
  return next;
}
