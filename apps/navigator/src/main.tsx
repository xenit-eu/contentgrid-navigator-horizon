import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { AppConfigProvider, AuthProvider, loadAppConfig } from "@contentgrid/navigator-data";
import "./index.css";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

loadAppConfig().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <AppConfigProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </AppConfigProvider>
    </StrictMode>,
  );
});
