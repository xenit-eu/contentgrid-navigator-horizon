import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { RootAuthGate } from "@contentgrid/features/app-shell";
import { NavigatorHeader } from "@contentgrid/features/navigator-header";
import type { NavigatorRouterContext } from "@contentgrid/navigator-data";

export const Route = createRootRouteWithContext<NavigatorRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootAuthGate>
      <div className="flex min-h-svh flex-col">
        <NavigatorHeader />
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </RootAuthGate>
  );
}
