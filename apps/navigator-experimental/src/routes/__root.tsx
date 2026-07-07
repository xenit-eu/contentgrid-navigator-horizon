import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { NavigatorRouterContext } from "@contentgrid/navigator-data";
import { NavigatorDataProvider, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";
import { ExperimentalBanner } from "../components/experimental-banner";

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
      <>
        <ExperimentalBanner />
        <Outlet />
      </>
    </NavigatorDataProvider>
  );
}
