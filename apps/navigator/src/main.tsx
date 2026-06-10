import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import {
  AppConfigProvider,
  AuthProvider,
  NavigatorDataProvider,
  loadAppConfig,
  useAppAuth,
} from "@contentgrid/navigator-data";
import "./index.css";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient();

// Bridges auth → data layer: useAppAuth derives an OIDC-token-supplied
// apiFetch and the profile URL from the runtime config, so it must render
// inside <AuthProvider> and after loadAppConfig() resolved.
function DataProviders({ children }: { children: ReactNode }) {
  const { apiFetch, profileUrl } = useAppAuth();
  return (
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider apiFetch={apiFetch} profileUrl={profileUrl}>
        {children}
      </NavigatorDataProvider>
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
          <DataProviders>
            <RouterProvider router={router} />
          </DataProviders>
        </AuthProvider>
      </AppConfigProvider>
    </StrictMode>,
  );
} catch (err: unknown) {
  rootEl.textContent = `Failed to load app configuration: ${err instanceof Error ? err.message : String(err)}`;
}
