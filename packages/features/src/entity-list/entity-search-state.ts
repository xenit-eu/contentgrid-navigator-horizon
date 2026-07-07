/**
 * Shape of the $entity route's search params.
 *
 * Deliberately NOT prefixed s.* — the cursor is a pagination mechanism, not a
 * search filter value. Matches the existing navigator's own convention
 * (SearchEntityPage.tsx): named search fields get the s. prefix, cursor stays
 * bare. See the cursor-token exception documented in
 * packages/navigator-data/CLAUDE.md.
 */
export interface EntitySearchState {
  cursor?: string;
}

/**
 * TanStack Router's `validateSearch` option for the $entity route.
 *
 * A non-string (or absent) cursor is treated as no cursor — matching the
 * guarantee the existing navigator gets for free from `URLSearchParams.get()`
 * (always `string | null`, never any other type). Beyond that type check,
 * there is deliberately no schema and no rejection: an invalid-but-string
 * cursor (stale/tampered token) surfaces as a normal backend request error,
 * handled by the existing "Back to first page" recovery UI, not as a
 * frontend-side check.
 */
export function validateEntitySearchState(search: Record<string, unknown>): EntitySearchState {
  return typeof search.cursor === "string" ? { cursor: search.cursor } : {};
}
