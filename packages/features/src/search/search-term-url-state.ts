import type { EntitySearchState } from "./entity-search-state";

/**
 * The URL search-state key that carries the single search bar's raw typed term (research D9,
 * FR-016). Rides as a plain sibling key in the same `EntitySearchState` bag `sort`/`s.*` filters
 * use — `q` doesn't collide with either.
 */
const SEARCH_TERM_KEY = "q";

/**
 * Reads the active search term back out of a route's URL search state. Returns `undefined` when
 * no term is active.
 */
export function decodeSearchTermFromSearchState(search: EntitySearchState): string | undefined {
  return search[SEARCH_TERM_KEY];
}

/**
 * Replaces the `q` slice of a route's URL search state, leaving every other key (including
 * `sort` and all `s.*` filters) untouched. Passing `term: undefined` (or `""`) removes the key
 * entirely rather than leaving a stale empty param behind.
 */
export function applySearchTermToSearchState(
  prev: EntitySearchState,
  term: string | undefined,
): EntitySearchState {
  const next: EntitySearchState = {};
  for (const [key, value] of Object.entries(prev)) {
    if (key !== SEARCH_TERM_KEY) next[key] = value;
  }
  if (term) next[SEARCH_TERM_KEY] = term;
  return next;
}
