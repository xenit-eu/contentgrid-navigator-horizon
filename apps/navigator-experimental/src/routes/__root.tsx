import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { UserPreferencesProvider } from "@contentgrid/features/user-preferences";
import { ThemeProvider, Toaster } from "@contentgrid/ui";
import { AuthShell } from "@contentgrid/views/auth-shell";
import type { AppRouterContext } from "@contentgrid/views/router-shell";
import { userPreferencesStore } from "../user-preferences-store";
import { RouterNavigationProvider } from "./-router-navigation-provider";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthShell>
        <UserPreferencesProvider store={userPreferencesStore}>
          <RouterNavigationProvider>
            <Outlet />
          </RouterNavigationProvider>
        </UserPreferencesProvider>
      </AuthShell>
      <Toaster />
    </ThemeProvider>
  );
}
