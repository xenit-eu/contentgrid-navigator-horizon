import type { QueryClient } from "@tanstack/react-query";
import type { TypedFetch } from "@contentgrid/navigator-data";

/**
 * Router-level context, available to every route's `beforeLoad`/`loader`.
 * `apiFetch`/`profileUrl` start `null` and are filled in once by
 * `mountNavigatorApp`'s router-context bridge — they don't depend on auth
 * completing, only on `useAppAuth()` having been called once (see
 * `navigator-app.tsx` for why).
 *
 * Shared by both navigator apps — the shape carries no app-specific fields,
 * so there is exactly one definition instead of one per app.
 */
export interface AppRouterContext {
  queryClient: QueryClient;
  apiFetch: TypedFetch | null;
  profileUrl: string | null;
}
