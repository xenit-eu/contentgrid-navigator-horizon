import type { EntitySearchState } from "@contentgrid/navigator-data";

/**
 * Namespaces filter keys within the route's generic `EntitySearchState` bag, so a filter (e.g.
 * `title`) round-trips through the URL as `s.title=<value>` — readable and shareable — without
 * colliding with any other, non-filter search-state field the route might add later.
 */
const FILTER_PREFIX = "s.";

/**
 * Reads the filter values back out of a route's URL search state. Only `s.`-prefixed keys are
 * filters; anything else in the bag is some other search-state concern and is ignored here.
 */
export function decodeFiltersFromSearchState(search: EntitySearchState): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && key.startsWith(FILTER_PREFIX)) {
      result[key.slice(FILTER_PREFIX.length)] = value;
    }
  }
  return result;
}

/**
 * Replaces the `s.*` slice of a route's URL search state with the given filters, leaving every
 * other key untouched. A full strip-then-merge (not a shallow spread) so clearing a filter, or
 * clicking "clear all", actually drops the corresponding `s.*` param instead of leaving a stale
 * one behind.
 */
export function applyFiltersToSearchState(
  prev: EntitySearchState,
  filters: Record<string, string>,
): EntitySearchState {
  const next: EntitySearchState = {};
  for (const [key, value] of Object.entries(prev)) {
    if (!key.startsWith(FILTER_PREFIX)) next[key] = value;
  }
  for (const [key, value] of Object.entries(filters)) {
    next[`${FILTER_PREFIX}${key}`] = value;
  }
  return next;
}
