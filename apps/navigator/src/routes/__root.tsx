import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import { ThemeProvider } from "@contentgrid/ui";
import type { AppRouterContext } from "../../../../packages/features/src/shells/router-shell";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthShell>
        <Outlet />
      </AuthShell>
    </ThemeProvider>
  );
}
