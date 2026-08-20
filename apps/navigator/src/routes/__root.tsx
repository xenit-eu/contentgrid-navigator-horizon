import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import type { AppRouterContext } from "../../../../packages/features/src/shells/router-shell";
import { Toaster } from "@contentgrid/ui";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthShell>
      <Outlet />
      <Toaster />
    </AuthShell>
  );
}
