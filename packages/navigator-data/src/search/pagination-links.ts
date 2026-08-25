import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";

/**
 * Two distinct mechanisms for handling a `next`/`prev` href safely, without
 * ever constructing a fetch URL from parts (root `CLAUDE.md`: "never
 * construct or parse pagination cursors — follow HAL next/prev links
 * directly"):
 *
 * 1. **Same-origin trust check** (`resolveTrustedCollectionUrl`) — for a full
 *    href accepted directly as a fetch target. Used by the to-many relation
 *    hook's ephemeral `{ url }` mode, and by `useEntityItemCollection`'s own
 *    `{ url }` mode.
 * 2. **Page-href memo** (`rememberCollectionPageHref` / `recallCollectionPageHref`)
 *    — pagination position is deliberately kept OUT of the browser URL
 *    (unlike filters, it isn't meant to be shareable: an opaque cursor only
 *    ever resolves back to a real page in the session that received it from
 *    the server). This just remembers the current page's literal href per
 *    entity in the `QueryClient` cache, so it survives an unmount/remount
 *    within the same session (e.g. navigating to an item and back) without
 *    the data layer ever reconstructing a URL from a cursor.
 */

/**
 * Resolve a caller-supplied cursor URL against the trusted API base and return
 * its absolute href IFF it resolves to the same origin as the API base.
 * Returns null otherwise (cross-origin, unparseable, or missing base) — fail closed.
 *
 * A caller-supplied cursor (e.g. from bookmarked or crafted URL state) could
 * otherwise point `apiFetch` — which unconditionally attaches the bearer
 * token — at an attacker-controlled origin. Anchoring on the absolute API
 * base (rather than a possibly-relative entity collection URL) guarantees the
 * trust anchor itself always parses: relative cursors resolve to the API
 * origin (trusted), absolute same-origin cursors are trusted, and absolute
 * cross-origin cursors are rejected.
 */
export function resolveTrustedCollectionUrl(
  suppliedUrl: string,
  apiBaseUrl: string,
): string | null {
  let baseOrigin: string;
  try {
    baseOrigin = new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }

  try {
    const resolved = new URL(suppliedUrl, apiBaseUrl);
    return resolved.origin === baseOrigin ? resolved.href : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the literal href for an entity's current page — the exact
 * `EntityItemCollection.nextHref`/`prevHref` the server returned — keyed by
 * entity name in the `QueryClient` cache. Pass `href: undefined` to clear it
 * (e.g. when filters change and the previous page no longer applies).
 *
 * `setQueryData(key, undefined)` is a documented no-op in TanStack Query (the
 * updater returning `undefined` leaves existing data untouched), so clearing
 * requires an explicit `removeQueries` rather than setting `undefined`.
 */
export function rememberCollectionPageHref(
  queryClient: QueryClient,
  entityName: string,
  href: string | undefined,
): void {
  const queryKey = queryKeys.collectionPage.byEntityName(entityName);
  if (href === undefined) {
    queryClient.removeQueries({ queryKey, exact: true });
  } else {
    queryClient.setQueryData(queryKey, href);
  }
}

/**
 * Resolves the remembered current-page href for an entity. Returns
 * `undefined` when nothing has been remembered in this session (first visit,
 * a fresh reload, or a bookmarked/shared link) — callers fall back to the
 * first-page request in that case.
 */
export function recallCollectionPageHref(
  queryClient: QueryClient,
  entityName: string,
): string | undefined {
  return queryClient.getQueryData(queryKeys.collectionPage.byEntityName(entityName));
}

/**
 * Remembers an entity's currently active filter values — keyed by entity name in the
 * `QueryClient` cache, mirroring `rememberCollectionPageHref` above. This is a SEPARATE memo,
 * not derived from the page-href one: the page href is only ever written on an explicit
 * next/prev click (see `EntityItemCollectionTable`), so a caller who applies a filter and
 * navigates away before ever paging through the result would have nothing to recover filters
 * from if they only relied on the page-href memo. Pass `filters: {}` to clear it (e.g. "clear
 * all filters" — a genuinely empty filter set is not worth remembering).
 */
export function rememberCollectionFilters(
  queryClient: QueryClient,
  entityName: string,
  filters: Record<string, string>,
): void {
  const queryKey = queryKeys.collectionFilters.byEntityName(entityName);
  if (Object.keys(filters).length === 0) {
    queryClient.removeQueries({ queryKey, exact: true });
  } else {
    queryClient.setQueryData(queryKey, filters);
  }
}

/**
 * Resolves the remembered active filter values for an entity. Returns `undefined` when nothing
 * has been remembered in this session (first visit, a fresh reload, or a bookmarked/shared
 * link) — callers fall back to no filters in that case.
 */
export function recallCollectionFilters(
  queryClient: QueryClient,
  entityName: string,
): Record<string, string> | undefined {
  return queryClient.getQueryData(queryKeys.collectionFilters.byEntityName(entityName));
}
