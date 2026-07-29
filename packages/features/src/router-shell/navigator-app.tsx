import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type AnyRouter, RouterProvider } from "@tanstack/react-router";
import {
  AppConfigProvider,
  AuthProvider,
  isAuthReady,
  loadAppConfig,
  useAppAuth,
} from "@contentgrid/navigator-data";

/**
 * Auth-gated router-context bridge: only pushes the authenticated
 * `apiFetch`/`profileUrl` into router context once auth has actually settled
 * (same `isAuthReady` check `AuthShell` uses) — otherwise a loader could fire
 * before the token is ready and send an unauthenticated request.
 */
function RouterContextBridge({
  router,
  queryClient,
}: Readonly<{ router: AnyRouter; queryClient: QueryClient }>) {
  const { auth, apiFetch, profileUrl } = useAppAuth();
  const ready = isAuthReady(auth);

  useEffect(() => {
    if (!ready) return;
    router.update({ context: { queryClient, apiFetch, profileUrl } });
    router.invalidate();
  }, [ready, apiFetch, profileUrl, router, queryClient]);

  return <RouterProvider router={router} />;
}

export interface MountNavigatorAppOptions {
  /** The DOM element to mount into (typically `document.getElementById("root")`). */
  rootEl: HTMLElement;
  /**
   * The app's own router instance. Built by the app's own `main.tsx` (not
   * here) because `createRouter` must be called with that app's own
   * `routeTree` for TanStack Router's route-tree type inference to work —
   * a shared factory would erase it to `AnyRouter` and break typed
   * `<Link>`/`useSearch`/etc. across the whole app.
   */
  router: AnyRouter;
  queryClient: QueryClient;
  /**
   * Dev-only mock-API bootstrap (MSW worker start). Each app supplies its own
   * because the dynamic `import("./mocks/browser")` path is per-app.
   */
  enableMocking?: () => Promise<void>;
}

/**
 * Shared bootstrap for both navigator apps (generic + experimental). Auth
 * gating, query-client wiring, the router-context bridge, mock-mode startup,
 * and mount/error-handling are identical between apps and live in exactly one
 * place — only the router instance and the mocking hook are supplied
 * per-app.
 */
export async function mountNavigatorApp(options: MountNavigatorAppOptions): Promise<void> {
  const { rootEl, router, queryClient, enableMocking } = options;

  try {
    await enableMocking?.();
    await loadAppConfig();
    createRoot(rootEl).render(
      <StrictMode>
        <AppConfigProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <RouterContextBridge router={router} queryClient={queryClient} />
              <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            </QueryClientProvider>
          </AuthProvider>
        </AppConfigProvider>
      </StrictMode>,
    );
  } catch (err: unknown) {
    rootEl.textContent = `Failed to load app configuration: ${err instanceof Error ? err.message : String(err)}`;
  }
}
