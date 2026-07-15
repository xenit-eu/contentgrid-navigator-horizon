import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@contentgrid/features/auth-shell";
import {
  AppConfigProvider,
  AuthProvider,
  isAuthReady,
  loadAppConfig,
  useAppAuth,
} from "@contentgrid/navigator-data";
import "./index.css";
import { routeTree } from "./routeTree.gen";
import type { AppRouterContext } from "./router-context";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient, apiFetch: null, profileUrl: null } satisfies AppRouterContext,
  defaultNotFoundComponent: NotFoundPage,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Only push the authenticated apiFetch/profileUrl into router context once
// auth has actually settled (same check as AuthShell) — otherwise a loader
// could fire before the token is ready and send an unauthenticated request.
function RouterContextBridge() {
  const { auth, apiFetch, profileUrl } = useAppAuth();
  const ready = isAuthReady(auth);

  useEffect(() => {
    if (!ready) return;
    router.update({ context: { queryClient, apiFetch, profileUrl } });
    router.invalidate();
  }, [ready, apiFetch, profileUrl]);

  return <RouterProvider router={router} />;
}

// Dev without a real backend: serve the stubbed HAL endpoint via MSW
// (paired with dev-token auth — see .env.development).
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API !== "true") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

try {
  await enableMocking();
  await loadAppConfig();
  createRoot(rootEl).render(
    <StrictMode>
      <AppConfigProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <RouterContextBridge />
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </QueryClientProvider>
        </AuthProvider>
      </AppConfigProvider>
    </StrictMode>,
  );
} catch (err: unknown) {
  rootEl.textContent = `Failed to load app configuration: ${err instanceof Error ? err.message : String(err)}`;
}
