import type { QueryClient } from "@tanstack/react-query";
import type { TypedFetch } from "../api/client";

/**
 * Shape of the TanStack Router context this package expects apps to supply.
 *
 * Apps create this via `createRootRouteWithContext<NavigatorRouterContext>()`
 * in `routes/__root.tsx`, then pass the actual values through `RouterProvider`'s
 * `context` prop (computed from `useAppAuth()` + the app's `QueryClient`, in the
 * same render pass — no `router.update()`/effect needed, since `useAppAuth()`
 * resolves `apiFetch`/`profileUrl` synchronously once config has loaded).
 *
 * Route `loader`s receive this via `({ context }) => ...` and use it with the
 * `ensure*` functions in `./prime-cache` to prime the TanStack Query cache
 * before the route's component renders — see ADR-005 ("pairs cleanly with
 * TanStack Query"). Components keep calling the existing hooks
 * (`useProfileEntities`, `useEntityItemCollection`, ...) unchanged; they simply
 * hit an already-warm cache instead of firing a fresh request. TanStack Query
 * remains the single source of truth for server state — loaders never return
 * data of their own for components to read via `useLoaderData()`.
 */
export interface NavigatorRouterContext {
  queryClient: QueryClient;
  apiFetch: TypedFetch;
  profileUrl: string;
}
