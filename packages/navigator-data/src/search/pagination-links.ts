import type { QueryClient } from "@tanstack/react-query";

/**
 * Two distinct mechanisms for handling a `next`/`prev` href safely, without
 * ever constructing a fetch URL from parts. Both exist to satisfy the same
 * platform invariant ("never construct or parse pagination cursors — follow
 * HAL next/prev links directly", root `CLAUDE.md`) — they differ because
 * pagination state has two different persistence needs in this app:
 *
 * 1. **Same-origin trust check** (`resolveTrustedCollectionUrl`) — for a full
 *    href accepted directly as a fetch target. Used by the to-many relation
 *    hook's ephemeral `{ url }` mode (`collection.nextHref`/`prevHref` kept
 *    in memory, never written to the browser URL). Verifies the href
 *    resolves to the same origin as the API base before it's ever handed to
 *    the bearer-token-attaching `apiFetch` — a caller-supplied href could
 *    otherwise redirect an authenticated request to an attacker-controlled
 *    origin.
 * 2. **Cursor registry** (`registerCursorHref` / `resolveCursorHref`) — for a
 *    href that must survive being represented as a short opaque value in the
 *    browser URL. Used by the entity-list's `cursor` route param (same name
 *    as the legacy navigator's `cursor` search param / `onCursorChange`): the
 *    cursor is bookmarkable, but the href itself never touches the URL, so
 *    there is nothing to decode. The registry remembers the literal href a
 *    cursor was minted from, keyed by entity + cursor, in the `QueryClient`
 *    cache.
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

const CURSOR_REGISTRY_KEY = "CursorHref";

/**
 * Remembers the literal href a `cursor` was minted from — the exact
 * `EntityItemCollection.nextHref`/`prevHref` the server returned, captured at
 * the moment it's still in hand (the Next/Previous click handler), before the
 * opaque cursor value is written to the URL's search state.
 *
 * The registry lives in the `QueryClient` cache (not a module-level map) so
 * it's scoped per app instance/test, and survives a route unmount/remount
 * within the same session (e.g. navigating to an item and back) without the
 * data layer ever needing to reconstruct a URL from the cursor.
 */
export function registerCursorHref(
  queryClient: QueryClient,
  entityName: string,
  cursor: string,
  href: string,
): void {
  queryClient.setQueryData([CURSOR_REGISTRY_KEY, entityName, cursor], href);
}

/**
 * Resolves a `cursor` back to the literal href it was registered with.
 * Returns `undefined` when the cursor was never registered in this session —
 * a bookmarked, shared, or freshly-reloaded cursor. Callers must fall back to
 * the first-page request in that case rather than guessing at a URL; there is
 * no compliant way to turn an opaque cursor back into a fetchable URL other
 * than having previously been handed that exact URL by the server.
 */
export function resolveCursorHref(
  queryClient: QueryClient,
  entityName: string,
  cursor: string,
): string | undefined {
  return queryClient.getQueryData([CURSOR_REGISTRY_KEY, entityName, cursor]);
}
