import type { QueryClient } from "@tanstack/react-query";

/**
 * Extracts a named query param's value from a `nextHref`/`prevHref` for
 * display/route-state purposes only. The href itself is never derived back
 * from this value — see `mintHrefToken`/`resolveHrefToken` below.
 *
 * Not part of the package's public API — internal to this module (and its
 * own test file). Consumers mint/resolve tokens via the two functions below.
 */
export function extractParamFromHref(
  href: string | undefined,
  paramName: string,
): string | undefined {
  if (!href) return undefined;
  try {
    // href (from EntityItemCollection.nextHref/prevHref) may be relative — a
    // placeholder base lets URL parse it without needing the real origin,
    // since only the query string is read here.
    return new URL(href, "https://placeholder").searchParams.get(paramName) ?? undefined;
  } catch {
    return undefined;
  }
}

const QUERY_PARAM_REGISTRY_KEY = "QueryParamRegistry";

/**
 * Mints the route-state token for a route param from the literal href it's
 * minted from — the exact `EntityItemCollection.nextHref`/`prevHref` the
 * server returned, captured at the moment it's still in hand (e.g. the
 * Next/Previous click handler), before the token is ever written to the URL.
 * Returns that token, which is what the caller actually writes to the URL;
 * registering the href for later resolution is this function's necessary
 * side effect, not its purpose.
 *
 * The token itself is never passed in — it's always derived from the href
 * (the HAL response's own query param) via `extractParamFromHref`, so there
 * is exactly one place that knows how to read a value out of a link. Returns
 * `undefined` when `href` carries no `paramName` param — nothing is
 * registered in that case.
 *
 * The registry lives in the `QueryClient` cache (not a module-level map) so
 * it's scoped per app instance/test and survives a route unmount/remount
 * within the same session, without the data layer ever needing to
 * reconstruct a URL from the token.
 */
export function mintHrefToken(
  queryClient: QueryClient,
  entityName: string,
  paramName: string,
  href: string | undefined,
): string | undefined {
  const token = extractParamFromHref(href, paramName);
  if (token && href) {
    queryClient.setQueryData([QUERY_PARAM_REGISTRY_KEY, entityName, paramName, token], href);
  }
  return token;
}

/**
 * Resolves a route-state token back to the literal href it was minted with.
 * Returns `undefined` when the token was never registered in this session —
 * a bookmarked, shared, or freshly-reloaded param. Callers must fall back to
 * the first-page request in that case rather than guessing at a URL; there
 * is no compliant way to turn an opaque token back into a fetchable URL other
 * than having previously been handed that exact URL by the server.
 */
export function resolveHrefToken(
  queryClient: QueryClient,
  entityName: string,
  paramName: string,
  token: string,
): string | undefined {
  return queryClient.getQueryData([QUERY_PARAM_REGISTRY_KEY, entityName, paramName, token]);
}
