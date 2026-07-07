/**
 * Run a route loader's cache-priming work best-effort: swallow any failure
 * instead of letting it crash the whole route via TanStack Router's default
 * error boundary.
 *
 * Why this is needed: a loader runs as soon as its route matches, independent
 * of the app's own auth-gating (e.g. `RootComponent` choosing to render a
 * sign-in screen instead of `<Outlet />`). Before a user is authenticated,
 * `apiFetch` has no valid token yet, so the prefetch request 401s — and an
 * uncaught rejection from a loader crashes the route with a generic
 * "Something went wrong" screen instead of letting the sign-in screen render.
 *
 * Swallowing the failure here is safe, not a silent failure: the component
 * this route renders calls the same data hooks itself (`useProfileEntities`,
 * `useEntityItemCollection`, `useEntityItem`), which independently fetch —
 * and correctly surface via their own `isError`/`error` state — any real,
 * persistent failure (auth still missing, backend down, etc.) once mounted.
 * The loader's only job is to warm the cache when it can; if it can't, the
 * component's own fetch takes over exactly as it did before loaders existed.
 */
export async function bestEffortPrefetch(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch {
    // Intentionally swallowed — see docstring above.
  }
}
