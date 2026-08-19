import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import type { AppRouterContext } from "@contentgrid/features/router-shell";
import { ThemeProvider } from "@contentgrid/ui";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthShell>
        <ExperimentalBanner />
        <Outlet />
      </AuthShell>
    </ThemeProvider>
  );
}
