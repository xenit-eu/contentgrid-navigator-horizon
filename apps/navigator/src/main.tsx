import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import {
  AppConfigProvider,
  AuthProvider,
  NavigatorDataProvider,
  loadAppConfig,
  useAppAuth,
} from "@contentgrid/navigator-data";
import type { NavigatorRouterContext } from "@contentgrid/navigator-data";
import "./index.css";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

// Router context is typed via NavigatorRouterContext (see __root.tsx's
// createRootRouteWithContext), but apiFetch/profileUrl aren't known until
// useAppAuth() resolves inside React — so the router is created with
// placeholder values, and DataProviders below supplies the real ones through
// RouterProvider's own `context` prop on every render. No router.update() /
// effect needed: useAppAuth() resolves apiFetch/profileUrl synchronously
// (once app config has already loaded, awaited below), so real context
// values are ready by the time RouterProvider first renders — no race.
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    apiFetch: undefined as unknown as NavigatorRouterContext["apiFetch"],
    profileUrl: undefined as unknown as NavigatorRouterContext["profileUrl"],
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Bridges auth → data layer: useAppAuth derives an OIDC-token-supplied
// apiFetch and the profile URL from the runtime config, so it must render
// inside <AuthProvider> and after loadAppConfig() resolved. Supplies both the
// React context (NavigatorDataProvider, read by hooks) and the router context
// (RouterProvider's context prop, read by route loaders) from the same values.
function DataProviders() {
  const { apiFetch, contentFetch, profileUrl } = useAppAuth();
  return (
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider apiFetch={apiFetch} contentFetch={contentFetch} profileUrl={profileUrl}>
        <RouterProvider router={router} context={{ queryClient, apiFetch, profileUrl }} />
      </NavigatorDataProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
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
          <DataProviders />
        </AuthProvider>
      </AppConfigProvider>
    </StrictMode>,
  );
} catch (err: unknown) {
  rootEl.textContent = `Failed to load app configuration: ${err instanceof Error ? err.message : String(err)}`;
}
