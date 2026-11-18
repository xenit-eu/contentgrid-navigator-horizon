import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider, Toaster } from "@contentgrid/ui";
import { AuthShell } from "@contentgrid/views/auth-shell";
import type { AppRouterContext } from "@contentgrid/views/router-shell";
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
