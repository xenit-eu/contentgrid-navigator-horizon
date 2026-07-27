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
