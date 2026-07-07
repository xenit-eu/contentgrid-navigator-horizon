import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { NavigatorHeader } from "@contentgrid/features/navigator-header";
import type { NavigatorRouterContext } from "@contentgrid/navigator-data";
import { NavigatorDataProvider, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";

export const Route = createRootRouteWithContext<NavigatorRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { auth, apiFetch, contentFetch, profileUrl } = useAppAuth();

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return <SignInGate onSignIn={() => auth.signinRedirect()} />;
  }

  return (
    <NavigatorDataProvider apiFetch={apiFetch} contentFetch={contentFetch} profileUrl={profileUrl}>
      <AppLayout />
    </NavigatorDataProvider>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <NavigatorHeader />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
