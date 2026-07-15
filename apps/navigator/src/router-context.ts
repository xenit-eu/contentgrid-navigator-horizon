import type { QueryClient } from "@tanstack/react-query";
import type { TypedFetch } from "@contentgrid/navigator-data";

/**
 * Router-level context, available to every route's `beforeLoad`/`loader`.
 * `apiFetch`/`profileUrl` start `null` and are filled in once by the bridge
 * in main.tsx — they don't depend on auth completing, only on useAppAuth()
 * having been called once (see main.tsx for why).
 */
export interface AppRouterContext {
  queryClient: QueryClient;
  apiFetch: TypedFetch | null;
  profileUrl: string | null;
}
