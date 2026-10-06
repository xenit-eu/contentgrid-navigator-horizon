import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import type { AppRouterContext } from "@contentgrid/features/router-shell";
import { ThemeProvider, Toaster } from "@contentgrid/ui";
import { AppNavigationProvider } from "../app-navigation";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthShell>
        <AppNavigationProvider>
          <Outlet />
        </AppNavigationProvider>
      </AuthShell>
      <Toaster />
    </ThemeProvider>
  );
}
