import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { RootAuthGate } from "@contentgrid/features/app-shell";
import type { NavigatorRouterContext } from "@contentgrid/navigator-data";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createRootRouteWithContext<NavigatorRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootAuthGate>
      <ExperimentalBanner />
      <Outlet />
    </RootAuthGate>
  );
}
