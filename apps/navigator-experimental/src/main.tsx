import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@contentgrid/features/app-info-pages";
import { mountNavigatorApp } from "@contentgrid/features/router-shell";
import type { AppRouterContext } from "@contentgrid/features/router-shell";
import { hasDevConfigOverride } from "@contentgrid/navigator-data";
import "./index.css";
import { routeTree } from "./routeTree.gen";

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

// Dev without a real backend: serve the stubbed HAL endpoint via MSW
// (paired with dev-token auth — see .env.development).
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API !== "true") return;
  if (hasDevConfigOverride()) {
    // eslint-disable-next-line no-console -- intentional: dev-only visibility into which backend is active.
    console.info("[navigator] Real backend selected via /config — local mock backend disabled.");
    return;
  }
  const { worker } = await import("./local-mock-backend/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  // eslint-disable-next-line no-console -- intentional, see the console.info above.
  console.info(
    "[navigator] Local mock backend active (VITE_USE_MOCK_API=true) — no real ContentGrid backend. Connect one at /config.",
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

await mountNavigatorApp({ rootEl, router, queryClient, enableMocking });
