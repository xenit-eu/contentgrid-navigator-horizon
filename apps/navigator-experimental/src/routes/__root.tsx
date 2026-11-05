import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import type { AppRouterContext } from "@contentgrid/features/router-shell";
import { ThemeProvider, Toaster } from "@contentgrid/ui";
import { RouterNavigationProvider } from "./-router-navigation-provider";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthShell>
        <RouterNavigationProvider>
          <Outlet />
        </RouterNavigationProvider>
      </AuthShell>
      <Toaster />
    </ThemeProvider>
  );
}
