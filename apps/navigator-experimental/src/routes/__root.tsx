import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthShell } from "@contentgrid/features/auth-shell";
import { ExperimentalBanner } from "../components/experimental-banner";
import type { AppRouterContext } from "../router-context";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthShell>
      <ExperimentalBanner />
      <Outlet />
    </AuthShell>
  );
}
